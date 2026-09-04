import {tokenize, type LanguageSpec, type Line} from './tokenize';

const PYTHON: LanguageSpec = {
	lineComment: '#',
	decorator: '@',
	blockComment: ['"""', '"""'],
	keywords: [
		'def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'in',
		'not', 'and', 'or', 'is', 'with', 'as', 'try', 'except', 'finally',
		'raise', 'yield', 'import', 'from', 'lambda', 'pass', 'assert', 'await',
		'async', 'None', 'True', 'False', 'self', 'global',
	],
	types: [
		'int', 'str', 'bool', 'float', 'dict', 'list', 'tuple', 'set', 'bytes',
		'Any', 'Optional', 'Sequence', 'Mapping', 'Iterator', 'Tensor', 'Module',
		'Callable',
	],
	errors: ['raise', 'except', 'ValueError', 'RuntimeError', 'assert'],
};

const TYPESCRIPT: LanguageSpec = {
	lineComment: '//',
	decorator: '@',
	blockComment: ['/*', '*/'],
	keywords: [
		'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'of',
		'while', 'class', 'extends', 'implements', 'interface', 'type', 'enum',
		'import', 'export', 'from', 'as', 'new', 'await', 'async', 'try',
		'catch', 'finally', 'throw', 'yield', 'this', 'null', 'undefined',
		'true', 'false', 'readonly', 'private', 'public', 'static', 'void',
	],
	types: [
		'string', 'number', 'boolean', 'unknown', 'never', 'Promise', 'Record',
		'Array', 'Map', 'Set', 'Partial', 'Readonly', 'Buffer', 'Uint8Array',
	],
	errors: ['throw', 'catch', 'Error', 'TypeError', 'AbortError'],
};

const RUST: LanguageSpec = {
	lineComment: '//',
	decorator: '#[',
	keywords: [
		'fn', 'let', 'mut', 'pub', 'use', 'mod', 'struct', 'impl', 'trait',
		'enum', 'match', 'if', 'else', 'for', 'in', 'while', 'loop', 'return',
		'const', 'static', 'ref', 'move', 'where', 'as', 'dyn', 'async',
		'await', 'unsafe', 'crate', 'self', 'Self', 'true', 'false',
	],
	types: [
		'u8', 'u16', 'u32', 'u64', 'usize', 'i32', 'i64', 'f32', 'f64', 'bool',
		'str', 'String', 'Vec', 'Option', 'Result', 'Box', 'Arc', 'Mutex',
		'HashMap', 'Some', 'None', 'Ok',
	],
	errors: ['Err', 'panic', 'unwrap', 'Error', 'expect'],
};

/**
 * Generic, plausible source. Line lengths vary widely and indentation runs
 * deep, because density -- not any individual line -- is what reads on screen.
 */
const PYTHON_SOURCE = `@dataclass(frozen=True)
class ShardPlan:
    """Placement of a parameter group across a device mesh."""

    dim_0_size: int
    tensor_numel: int
    chunk_size: int
    pg_device: Optional[str] = None

    def validate(self) -> None:
        if self.chunk_size <= 0:
            raise ValueError(f"chunk_size must be positive, got {self.chunk_size}")
        if self.tensor_numel % self.chunk_size:
            raise ValueError("tensor_numel is not divisible by chunk_size")


def _shard_flat_tensor(local_tensor: Tensor, plan: ShardPlan) -> list[Tensor]:
    # Pad to a multiple of the chunk so every rank receives the same shape.
    num_padding = plan.chunk_size - (local_tensor.numel() % plan.chunk_size)
    if num_padding > 0:
        local_tensor = F.pad(local_tensor, [0, num_padding])
    return list(local_tensor.chunk(plan.dim_0_size, dim=0))


@torch.no_grad()
def copy_state_dict(
    state_dict: dict[str, Any],
    copy_state_dict: dict[str, Any],
    non_blocking: bool = False,
    type_check: bool = True,
) -> dict[str, Any]:
    """
    Copies all tensors in a given state dict into a different state dict with
    the same structure. Additionally, a copied state dict with the same value
    references is returned. Editing the keys on this state dict will not affect
    the tensors in the original state dict; the value references are the same.
    """
    for key, value in state_dict.items():
        target = copy_state_dict.get(key)
        if target is None:
            if type_check:
                raise RuntimeError(f"missing key in destination: {key!r}")
            continue
        if isinstance(value, torch.Tensor):
            target.copy_(value, non_blocking=non_blocking)
        elif isinstance(value, Mapping):
            copy_state_dict(value, target, non_blocking, type_check)
        else:
            copy_state_dict[key] = deepcopy(value)
    return copy_state_dict
`;

const TYPESCRIPT_SOURCE = `export interface StreamOptions {
  /** Upper bound on buffered frames before back-pressure kicks in. */
  readonly highWaterMark: number;
  readonly signal?: AbortSignal;
  readonly onDrain?: () => void;
}

type FrameHeader = Readonly<{
  sequence: number;
  payloadLength: number;
  compressed: boolean;
}>;

const HEADER_BYTES = 12;
const MAX_PAYLOAD = 1 << 20;

function decodeHeader(view: DataView, offset: number): FrameHeader {
  const sequence = view.getUint32(offset, true);
  const payloadLength = view.getUint32(offset + 4, true);
  const flags = view.getUint32(offset + 8, true);
  if (payloadLength > MAX_PAYLOAD) {
    throw new RangeError(\`payload of \${payloadLength} exceeds the frame limit\`);
  }
  return {sequence, payloadLength, compressed: (flags & 0x1) !== 0};
}

export async function* readFrames(
  source: ReadableStream<Uint8Array>,
  options: StreamOptions,
): AsyncGenerator<Uint8Array, void, undefined> {
  const reader = source.getReader();
  let carry = new Uint8Array(0);
  try {
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      carry = concat(carry, value);
      while (carry.byteLength >= HEADER_BYTES) {
        const header = decodeHeader(new DataView(carry.buffer), 0);
        const total = HEADER_BYTES + header.payloadLength;
        if (carry.byteLength < total) break;
        yield carry.subarray(HEADER_BYTES, total);
        carry = carry.subarray(total);
      }
    }
  } catch (error) {
    if (!isAbortError(error)) throw error;
  } finally {
    reader.releaseLock();
    options.onDrain?.();
  }
}
`;

const RUST_SOURCE = `#[derive(Debug, Clone, PartialEq)]
pub struct SegmentIndex {
    entries: Vec<IndexEntry>,
    base_offset: u64,
    max_entries: usize,
}

#[derive(Debug, Clone, Copy)]
struct IndexEntry {
    relative_offset: u32,
    physical_position: u32,
}

impl SegmentIndex {
    /// Returns the greatest entry whose offset does not exceed \`target\`.
    pub fn lookup(&self, target: u64) -> Option<IndexEntry> {
        if target < self.base_offset {
            return None;
        }
        let relative = (target - self.base_offset) as u32;
        let idx = match self.entries.binary_search_by_key(&relative, |e| e.relative_offset) {
            Ok(exact) => exact,
            Err(0) => return None,
            Err(next) => next - 1,
        };
        self.entries.get(idx).copied()
    }

    pub fn append(&mut self, offset: u64, position: u32) -> Result<(), IndexError> {
        if self.entries.len() >= self.max_entries {
            return Err(IndexError::Full { capacity: self.max_entries });
        }
        let relative = offset
            .checked_sub(self.base_offset)
            .ok_or(IndexError::OffsetTooSmall)? as u32;
        if let Some(last) = self.entries.last() {
            if relative <= last.relative_offset {
                return Err(IndexError::NonMonotonic);
            }
        }
        // Entries stay sorted, so lookup can keep using a binary search.
        self.entries.push(IndexEntry { relative_offset: relative, physical_position: position });
        Ok(())
    }

    pub fn truncate_to(&mut self, offset: u64) -> usize {
        let before = self.entries.len();
        match offset.checked_sub(self.base_offset) {
            None => self.entries.clear(),
            Some(relative) => {
                let cut = relative as u32;
                self.entries.retain(|entry| entry.relative_offset < cut);
            }
        }
        before - self.entries.len()
    }
}
`;

const toLines = (source: string, lang: LanguageSpec): Line[] =>
	tokenize(source.replace(/\n+$/, ''), lang);

/**
 * Tokenised once at module load. Nothing here re-runs per frame.
 */
export const CORPORA = {
	python: toLines(PYTHON_SOURCE, PYTHON),
	typescript: toLines(TYPESCRIPT_SOURCE, TYPESCRIPT),
	rust: toLines(RUST_SOURCE, RUST),
} as const;

export type CorpusName = keyof typeof CORPORA;
