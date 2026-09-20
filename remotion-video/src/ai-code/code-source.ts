// Original ML-flavoured Python used as the on-screen text.
//
// Written for this project rather than lifted from a real library: the
// references clearly show deep-learning internals, and the point is the
// *texture* of tensor/dtype/distributed code, not any actual source.
// Lines are deliberately varied in length so the panels get the ragged
// silhouette the references have.

const SPARSE_KERNELS = `
# --- meta kernels: shape/dtype inference without touching memory ---
@register_meta(ops.aten.blocksparse_matmul)
def meta_blocksparse_matmul(
    lhs_values: Tensor,
    lhs_indices: Tensor,
    rhs: Tensor,
    bias: Optional[Tensor] = None,
    alpha: Optional[Number] = None,
    out_dtype: Optional[torch.dtype] = None,
    transpose_rhs: bool = False,
    block_size: int = 32,
    split_k: int = 1,
    fuse_epilogue: bool = True,
):
    assert rhs.dtype in {
        torch.float32,
        torch.float16,
        torch.bfloat16,
        torch.int8,
        torch.float8_e4m3fn,
    }, "blocksparse_matmul supports fp32, fp16, bf16, int8 and fp8 only"
    assert lhs_values.dtype == rhs.dtype, "operands must share a dtype"
    assert lhs_indices.ndim == 2, "indices must be (nnz_blocks, 2)"

    is_quantized = rhs.dtype in (torch.int8, torch.float8_e4m3fn)
    accum_dtype = torch.int32 if rhs.dtype is torch.int8 else torch.float32
    packing_factor = 4 if is_quantized else 1

    if is_quantized:
        assert alpha is not None, "quantized paths require a scale"
        assert not rhs.is_contiguous() or transpose_rhs, (
            "quantized rhs must be transposed for the tensor-core layout"
        )

    m = lhs_indices.max().item() * block_size
    n = rhs.shape[0] if transpose_rhs else rhs.shape[-1]
    result_dtype = out_dtype if out_dtype is not None else accum_dtype
    return rhs.new_empty((m, n // packing_factor), dtype=result_dtype)
`;

const AUTOGRAD_HOOKS = `
class RecordedFunction:
    """Wraps a callable so the profiler can bracket it with events."""

    def __init__(self, name: str, kind: EventKind = EventKind.FUNCTION):
        self.name = name
        self.kind = kind
        self.handle: int = 0
        self._entered = False

    def __enter__(self):
        if self._entered:
            raise RuntimeError("RecordedFunction is not reentrant")
        self._entered = True
        self.handle = _C._record_function_enter(self.name, self.kind.value)
        return self

    def __exit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
        if not self._entered:
            return
        _C._record_function_exit(self.handle)
        self._entered = False

    def bind(self, future: Future[Any]) -> Future[Any]:
        # Extends the record past this scope so async work that escapes
        # the block is still attributed to it. Safe to call once.
        return _C._call_end_callbacks_on_future(self.handle, future)
`;

const DISTRIBUTED_STATE = `
@torch.no_grad()
def gather_state_dict(
    module: nn.Module,
    *,
    cpu_offload: bool = True,
    ranks_only: Tuple[int, ...] = (),
    share_memory: bool = False,
    full_precision: bool = True,
) -> Dict[str, Any]:
    """Collects sharded parameters into one full state dict.

    Every tensor is materialised on the coordinating ranks. Keys keep
    their original names so the result reloads into an unsharded copy
    of the same module without remapping.
    """
    group = _resolve_process_group(module)
    rank = dist.get_rank(group)
    collect_here = not ranks_only or rank in ranks_only

    gathered: Dict[str, Any] = {}
    for name, param in module.named_parameters(remove_duplicate=False):
        if not isinstance(param, ShardedTensor):
            gathered[name] = param.detach()
            continue

        full = param.gather(dst=ranks_only[0] if ranks_only else 0)
        if not collect_here:
            continue
        if full_precision and full.dtype in (torch.float16, torch.bfloat16):
            full = full.float()
        if cpu_offload:
            full = full.to("cpu", non_blocking=True)
        if share_memory:
            full = full.share_memory_()
        gathered[name] = full

    dist.barrier(group)
    return gathered
`;

const DIVERGENCE = `
def kl_divergence(p: Distribution, q: Distribution) -> Tensor:
    """KL(p || q), dispatched on the concrete distribution pair."""
    try:
        fn = _KL_REGISTRY[type(p), type(q)]
    except KeyError:
        raise NotImplementedError(
            f"no KL rule registered for {type(p).__name__} || {type(q).__name__}"
        ) from None
    return fn(p, q)


@register_kl(Normal, Normal)
def _kl_normal_normal(p: Normal, q: Normal) -> Tensor:
    var_ratio = (p.scale / q.scale).pow(2)
    mean_sq = ((p.loc - q.loc) / q.scale).pow(2)
    return 0.5 * (var_ratio + mean_sq - 1.0 - var_ratio.log())


@register_kl(Categorical, Categorical)
def _kl_categorical(p: Categorical, q: Categorical) -> Tensor:
    support = (p.probs > 0) & (q.probs > 0)
    terms = p.probs * (p.logits - q.logits)
    return terms.masked_fill(~support, 0.0).sum(-1)
`;

const MODULE_LOADER = `
def import_module_from_spec(name: str, path: Optional[str] = None):
    """Imports a module by name, honouring a lazy loader if one is set."""
    spec = importlib.util.find_spec(name, path)
    if spec is None:
        raise ModuleNotFoundError(f"no module named {name!r}", name=name)

    loader = spec.loader
    if loader is None:
        raise ImportError("spec has no loader", name=name, path=spec.origin)

    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    try:
        loader.exec_module(module)
    except BaseException:
        # A half-initialised module must never stay in sys.modules or the
        # next import silently succeeds against a broken object.
        sys.modules.pop(name, None)
        raise
    return module
`;

const ATTENTION = `
def scaled_dot_product(
    query: Tensor,
    key: Tensor,
    value: Tensor,
    attn_mask: Optional[Tensor] = None,
    dropout_p: float = 0.0,
    is_causal: bool = False,
    scale: Optional[float] = None,
) -> Tensor:
    head_dim = query.size(-1)
    softmax_scale = scale if scale is not None else head_dim ** -0.5

    scores = query @ key.transpose(-2, -1) * softmax_scale
    if is_causal:
        seq_q, seq_k = query.size(-2), key.size(-2)
        causal = torch.ones(seq_q, seq_k, dtype=torch.bool).tril(seq_k - seq_q)
        scores = scores.masked_fill(~causal, float("-inf"))
    if attn_mask is not None:
        scores = scores + attn_mask

    weights = torch.softmax(scores, dim=-1, dtype=torch.float32)
    weights = weights.to(query.dtype)
    if dropout_p > 0.0:
        weights = torch.dropout(weights, dropout_p, train=True)
    return weights @ value
`;

const QUANT_CONFIG = `
@dataclass(frozen=True)
class QuantConfig:
    weight_dtype: torch.dtype = torch.int8
    activation_dtype: torch.dtype = torch.bfloat16
    group_size: int = 128
    symmetric: bool = True
    clip_ratio: float = 0.98
    skip_modules: Tuple[str, ...] = ("lm_head", "embed_tokens")

    def compression_factor(self) -> int:
        bits = _DTYPE_BITS[self.weight_dtype]
        return 32 // bits if bits else 1

    def validate(self) -> None:
        if self.group_size % 32:
            raise ValueError("group_size must be a multiple of 32")
        if not 0.0 < self.clip_ratio <= 1.0:
            raise ValueError("clip_ratio must fall in (0, 1]")
`;

/** All snippets, in the order they read best when tiled together. */
export const CODE_BLOCKS: readonly string[] = [
  SPARSE_KERNELS,
  ATTENTION,
  DISTRIBUTED_STATE,
  AUTOGRAD_HOOKS,
  DIVERGENCE,
  QUANT_CONFIG,
  MODULE_LOADER,
];

export type CodeLine = {
  readonly text: string;
  /** Inside a triple-quoted docstring, so it colours as a string. */
  readonly doc: boolean;
};

/**
 * One flat line array. Docstring membership is resolved here, over the
 * whole corpus, because the highlighter is handed arbitrary slices and
 * could not otherwise tell prose inside a docstring from bare
 * identifiers.
 */
export const CODE_LINES: readonly CodeLine[] = CODE_BLOCKS.flatMap((block) => {
  let inDoc = false;
  return block
    .trim()
    .split("\n")
    .map((text) => {
      const fences = (text.match(/"""|'''/g) ?? []).length;
      const wasInDoc = inDoc;
      if (fences % 2 === 1) {
        inDoc = !inDoc;
      }
      return { text, doc: wasInDoc || inDoc };
    });
});

/**
 * `count` consecutive lines starting at `start`, wrapping around the
 * corpus so any (start, count) is valid.
 */
export const sliceLines = (start: number, count: number): CodeLine[] => {
  const total = CODE_LINES.length;
  const out: CodeLine[] = [];
  for (let i = 0; i < count; i++) {
    out.push(CODE_LINES[(((start + i) % total) + total) % total]);
  }
  return out;
};
