(self["webpackChunkcloudflight_rainbowrings_sunleaves_datagrid_ripplerings"] = self["webpackChunkcloudflight_rainbowrings_sunleaves_datagrid_ripplerings"] || []).push([[897],{

/***/ 8133
(module) {


module.exports = parse

/**
 * expected argument lengths
 * @type {Object}
 */

var length = {a: 7, c: 6, h: 1, l: 2, m: 2, q: 4, s: 4, t: 2, v: 1, z: 0}

/**
 * segment pattern
 * @type {RegExp}
 */

var segment = /([astvzqmhlc])([^astvzqmhlc]*)/ig

/**
 * parse an svg path data string. Generates an Array
 * of commands where each command is an Array of the
 * form `[command, arg1, arg2, ...]`
 *
 * @param {String} path
 * @return {Array}
 */

function parse(path) {
	var data = []
	path.replace(segment, function(_, command, args){
		var type = command.toLowerCase()
		args = parseValues(args)

		// overloaded moveTo
		if (type == 'm' && args.length > 2) {
			data.push([command].concat(args.splice(0, 2)))
			type = 'l'
			command = command == 'm' ? 'l' : 'L'
		}

		while (true) {
			if (args.length == length[type]) {
				args.unshift(command)
				return data.push(args)
			}
			if (args.length < length[type]) throw new Error('malformed path data')
			data.push([command].concat(args.splice(0, length[type])))
		}
	})
	return data
}

var number = /-?[0-9]*\.?[0-9]+(?:e[-+]?\d+)?/ig

function parseValues(args) {
	var numbers = args.match(number)
	return numbers ? numbers.map(Number) : []
}


/***/ },

/***/ 4802
(__unused_webpack___webpack_module__, __unused_webpack___webpack_exports__, __webpack_require__) {

"use strict";

// EXTERNAL MODULE: ./node_modules/pixi.js/lib/extensions/Extensions.mjs
var Extensions = __webpack_require__(8507);
;// ./node_modules/pixi.js/lib/app/ResizePlugin.mjs


"use strict";
class ResizePlugin {
  /**
   * Initialize the plugin with scope of application instance
   * @private
   * @param {object} [options] - See application options
   */
  static init(options) {
    Object.defineProperty(
      this,
      "resizeTo",
      {
        set(dom) {
          globalThis.removeEventListener("resize", this.queueResize);
          this._resizeTo = dom;
          if (dom) {
            globalThis.addEventListener("resize", this.queueResize);
            this.resize();
          }
        },
        get() {
          return this._resizeTo;
        }
      }
    );
    this.queueResize = () => {
      if (!this._resizeTo) {
        return;
      }
      this._cancelResize();
      this._resizeId = requestAnimationFrame(() => this.resize());
    };
    this._cancelResize = () => {
      if (this._resizeId) {
        cancelAnimationFrame(this._resizeId);
        this._resizeId = null;
      }
    };
    this.resize = () => {
      if (!this._resizeTo) {
        return;
      }
      this._cancelResize();
      let width;
      let height;
      if (this._resizeTo === globalThis.window) {
        width = globalThis.innerWidth;
        height = globalThis.innerHeight;
      } else {
        const { clientWidth, clientHeight } = this._resizeTo;
        width = clientWidth;
        height = clientHeight;
      }
      this.renderer.resize(width, height);
      this.render();
    };
    this._resizeId = null;
    this._resizeTo = null;
    this.resizeTo = options.resizeTo || null;
  }
  /**
   * Clean up the ticker, scoped to application
   * @private
   */
  static destroy() {
    globalThis.removeEventListener("resize", this.queueResize);
    this._cancelResize();
    this._cancelResize = null;
    this.queueResize = null;
    this.resizeTo = null;
    this.resize = null;
  }
}
/** @ignore */
ResizePlugin.extension = Extensions/* ExtensionType */.Ag.Application;


//# sourceMappingURL=ResizePlugin.mjs.map

// EXTERNAL MODULE: ./node_modules/pixi.js/lib/ticker/const.mjs
var ticker_const = __webpack_require__(4458);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/ticker/Ticker.mjs + 1 modules
var Ticker = __webpack_require__(5712);
;// ./node_modules/pixi.js/lib/app/TickerPlugin.mjs




"use strict";
class TickerPlugin {
  /**
   * Initialize the plugin with scope of application instance
   * @private
   * @param {object} [options] - See application options
   */
  static init(options) {
    options = Object.assign({
      autoStart: true,
      sharedTicker: false
    }, options);
    Object.defineProperty(
      this,
      "ticker",
      {
        set(ticker) {
          if (this._ticker) {
            this._ticker.remove(this.render, this);
          }
          this._ticker = ticker;
          if (ticker) {
            ticker.add(this.render, this, ticker_const/* UPDATE_PRIORITY */.d.LOW);
          }
        },
        get() {
          return this._ticker;
        }
      }
    );
    this.stop = () => {
      this._ticker.stop();
    };
    this.start = () => {
      this._ticker.start();
    };
    this._ticker = null;
    this.ticker = options.sharedTicker ? Ticker/* Ticker */.R.shared : new Ticker/* Ticker */.R();
    if (options.autoStart) {
      this.start();
    }
  }
  /**
   * Clean up the ticker, scoped to application.
   * @private
   */
  static destroy() {
    if (this._ticker) {
      const oldTicker = this._ticker;
      this.ticker = null;
      oldTicker.destroy();
    }
  }
}
/** @ignore */
TickerPlugin.extension = Extensions/* ExtensionType */.Ag.Application;


//# sourceMappingURL=TickerPlugin.mjs.map

;// ./node_modules/pixi.js/lib/app/init.mjs




"use strict";
Extensions/* extensions */.XO.add(ResizePlugin);
Extensions/* extensions */.XO.add(TickerPlugin);
//# sourceMappingURL=init.mjs.map


/***/ },

/***/ 6152
(__unused_webpack___webpack_module__, __unused_webpack___webpack_exports__, __webpack_require__) {

"use strict";

// EXTERNAL MODULE: ./node_modules/pixi.js/lib/extensions/Extensions.mjs
var Extensions = __webpack_require__(8507);
;// ./node_modules/pixi.js/lib/filters/FilterPipe.mjs


"use strict";
class FilterPipe {
  constructor(renderer) {
    this._renderer = renderer;
  }
  push(filterEffect, container, instructionSet) {
    const renderPipes = this._renderer.renderPipes;
    renderPipes.batch.break(instructionSet);
    instructionSet.add({
      renderPipeId: "filter",
      canBundle: false,
      action: "pushFilter",
      container,
      filterEffect
    });
  }
  pop(_filterEffect, _container, instructionSet) {
    this._renderer.renderPipes.batch.break(instructionSet);
    instructionSet.add({
      renderPipeId: "filter",
      action: "popFilter",
      canBundle: false
    });
  }
  execute(instruction) {
    if (instruction.action === "pushFilter") {
      this._renderer.filter.push(instruction);
    } else if (instruction.action === "popFilter") {
      this._renderer.filter.pop();
    }
  }
  destroy() {
    this._renderer = null;
  }
}
FilterPipe.extension = {
  type: [
    Extensions/* ExtensionType */.Ag.WebGLPipes,
    Extensions/* ExtensionType */.Ag.WebGPUPipes,
    Extensions/* ExtensionType */.Ag.CanvasPipes
  ],
  name: "filter"
};


//# sourceMappingURL=FilterPipe.mjs.map

// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/gl/shader/GlProgram.mjs + 6 modules
var GlProgram = __webpack_require__(2112);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/gpu/shader/GpuProgram.mjs + 6 modules
var GpuProgram = __webpack_require__(9080);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/filters/Filter.mjs
var Filter = __webpack_require__(6554);
;// ./node_modules/pixi.js/lib/filters/defaults/defaultFilter.vert.mjs
var vertex = "in vec2 aPosition;\nout vec2 vTextureCoord;\n\nuniform vec4 uInputSize;\nuniform vec4 uOutputFrame;\nuniform vec4 uOutputTexture;\n\nvec4 filterVertexPosition( void )\n{\n    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;\n    \n    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;\n    position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;\n\n    return vec4(position, 0.0, 1.0);\n}\n\nvec2 filterTextureCoord( void )\n{\n    return aPosition * (uOutputFrame.zw * uInputSize.zw);\n}\n\nvoid main(void)\n{\n    gl_Position = filterVertexPosition();\n    vTextureCoord = filterTextureCoord();\n}\n";


//# sourceMappingURL=defaultFilter.vert.mjs.map

;// ./node_modules/pixi.js/lib/filters/defaults/passthrough/passthrough.frag.mjs
var fragment = "in vec2 vTextureCoord;\nout vec4 finalColor;\nuniform sampler2D uTexture;\nvoid main() {\n    finalColor = texture(uTexture, vTextureCoord);\n}\n";


//# sourceMappingURL=passthrough.frag.mjs.map

;// ./node_modules/pixi.js/lib/filters/defaults/passthrough/passthrough.wgsl.mjs
var source = "struct GlobalFilterUniforms {\n  uInputSize: vec4<f32>,\n  uInputPixel: vec4<f32>,\n  uInputClamp: vec4<f32>,\n  uOutputFrame: vec4<f32>,\n  uGlobalFrame: vec4<f32>,\n  uOutputTexture: vec4<f32>,\n};\n\n@group(0) @binding(0) var <uniform> gfu: GlobalFilterUniforms;\n@group(0) @binding(1) var uTexture: texture_2d<f32>;\n@group(0) @binding(2) var uSampler: sampler;\n\nstruct VSOutput {\n  @builtin(position) position: vec4<f32>,\n  @location(0) uv: vec2<f32>\n};\n\nfn filterVertexPosition(aPosition: vec2<f32>) -> vec4<f32>\n{\n    var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;\n\n    position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;\n    position.y = position.y * (2.0 * gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;\n\n    return vec4(position, 0.0, 1.0);\n}\n\nfn filterTextureCoord(aPosition: vec2<f32>) -> vec2<f32>\n{\n    return aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw);\n}\n\n@vertex\nfn mainVertex(\n  @location(0) aPosition: vec2<f32>,\n) -> VSOutput {\n  return VSOutput(\n   filterVertexPosition(aPosition),\n   filterTextureCoord(aPosition)\n  );\n}\n\n@fragment\nfn mainFragment(\n  @location(0) uv: vec2<f32>,\n) -> @location(0) vec4<f32> {\n    return textureSample(uTexture, uSampler, uv);\n}\n";


//# sourceMappingURL=passthrough.wgsl.mjs.map

;// ./node_modules/pixi.js/lib/filters/defaults/passthrough/PassthroughFilter.mjs







"use strict";
class PassthroughFilter extends Filter/* Filter */.d {
  constructor() {
    const gpuProgram = GpuProgram/* GpuProgram */.B.from({
      vertex: { source: source, entryPoint: "mainVertex" },
      fragment: { source: source, entryPoint: "mainFragment" },
      name: "passthrough-filter"
    });
    const glProgram = GlProgram/* GlProgram */.M.from({
      vertex: vertex,
      fragment: fragment,
      name: "passthrough-filter"
    });
    super({
      gpuProgram,
      glProgram
    });
  }
}


//# sourceMappingURL=PassthroughFilter.mjs.map

// EXTERNAL MODULE: ./node_modules/pixi.js/lib/maths/matrix/Matrix.mjs
var Matrix = __webpack_require__(9313);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/gpu/shader/BindGroup.mjs
var BindGroup = __webpack_require__(3513);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/geometry/Geometry.mjs + 2 modules
var Geometry = __webpack_require__(1729);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/shader/UniformGroup.mjs + 2 modules
var UniformGroup = __webpack_require__(1911);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/texture/Texture.mjs + 2 modules
var Texture = __webpack_require__(226);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/texture/TexturePool.mjs
var TexturePool = __webpack_require__(2437);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/types.mjs
var types = __webpack_require__(5099);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/container/bounds/Bounds.mjs
var Bounds = __webpack_require__(9636);
;// ./node_modules/pixi.js/lib/scene/container/bounds/getRenderableBounds.mjs



"use strict";
const tempProjectionMatrix = new Matrix/* Matrix */.u();
function getGlobalRenderableBounds(renderables, bounds) {
  bounds.clear();
  const actualMatrix = bounds.matrix;
  for (let i = 0; i < renderables.length; i++) {
    const renderable = renderables[i];
    if (renderable.globalDisplayStatus < 7) {
      continue;
    }
    const renderGroup = renderable.renderGroup ?? renderable.parentRenderGroup;
    if (renderGroup?.isCachedAsTexture) {
      bounds.matrix = tempProjectionMatrix.copyFrom(renderGroup.textureOffsetInverseTransform).append(renderable.worldTransform);
    } else if (renderGroup?._parentCacheAsTextureRenderGroup) {
      bounds.matrix = tempProjectionMatrix.copyFrom(renderGroup._parentCacheAsTextureRenderGroup.inverseWorldTransform).append(renderable.groupTransform);
    } else {
      bounds.matrix = renderable.worldTransform;
    }
    bounds.addBounds(renderable.bounds);
  }
  bounds.matrix = actualMatrix;
  return bounds;
}


//# sourceMappingURL=getRenderableBounds.mjs.map

// EXTERNAL MODULE: ./node_modules/pixi.js/lib/utils/logging/warn.mjs
var warn = __webpack_require__(268);
;// ./node_modules/pixi.js/lib/filters/FilterSystem.mjs













"use strict";
const quadGeometry = new Geometry/* Geometry */.V({
  attributes: {
    aPosition: {
      buffer: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      format: "float32x2",
      stride: 2 * 4,
      offset: 0
    }
  },
  indexBuffer: new Uint32Array([0, 1, 2, 0, 2, 3])
});
class FilterData {
  constructor() {
    /**
     * Indicates whether the filter should be skipped.
     * @type {boolean}
     */
    this.skip = false;
    /**
     * The texture to which the filter is applied.
     * @type {Texture}
     */
    this.inputTexture = null;
    /**
     * The back texture used for blending, if required.
     * @type {Texture | null}
     */
    this.backTexture = null;
    /**
     * The list of filters to be applied.
     * @type {Filter[]}
     */
    this.filters = null;
    /**
     * The bounds of the filter area.
     * @type {Bounds}
     */
    this.bounds = new Bounds/* Bounds */.c();
    /**
     * The container to which the filter is applied.
     * @type {Container}
     */
    this.container = null;
    /**
     * Indicates whether blending is required for the filter.
     * @type {boolean}
     */
    this.blendRequired = false;
    /**
     * The render surface where the output of the filter is rendered.
     * @type {RenderSurface}
     */
    this.outputRenderSurface = null;
    /**
     * The global frame of the filter area.
     * @type {{ x: number, y: number, width: number, height: number }}
     */
    this.globalFrame = { x: 0, y: 0, width: 0, height: 0 };
    /** The first enabled filter index in the current filter list. */
    this.firstEnabledIndex = -1;
    /** The last enabled filter index in the current filter list. */
    this.lastEnabledIndex = -1;
  }
}
class FilterSystem {
  constructor(renderer) {
    this._filterStackIndex = 0;
    this._filterStack = [];
    this._filterGlobalUniforms = new UniformGroup/* UniformGroup */.k({
      uInputSize: { value: new Float32Array(4), type: "vec4<f32>" },
      uInputPixel: { value: new Float32Array(4), type: "vec4<f32>" },
      uInputClamp: { value: new Float32Array(4), type: "vec4<f32>" },
      uOutputFrame: { value: new Float32Array(4), type: "vec4<f32>" },
      uGlobalFrame: { value: new Float32Array(4), type: "vec4<f32>" },
      uOutputTexture: { value: new Float32Array(4), type: "vec4<f32>" }
    });
    this._globalFilterBindGroup = new BindGroup/* BindGroup */.T({});
    this.renderer = renderer;
  }
  /**
   * The back texture of the currently active filter. Requires the filter to have `blendRequired` set to true.
   * @readonly
   */
  get activeBackTexture() {
    return this._activeFilterData?.backTexture;
  }
  /**
   * Pushes a filter instruction onto the filter stack.
   * @param instruction - The instruction containing the filter effect and container.
   * @internal
   */
  push(instruction) {
    const renderer = this.renderer;
    const filters = instruction.filterEffect.filters;
    const filterData = this._pushFilterData();
    filterData.skip = false;
    filterData.filters = filters;
    filterData.container = instruction.container;
    filterData.outputRenderSurface = renderer.renderTarget.renderSurface;
    const colorTextureSource = renderer.renderTarget.renderTarget.colorTexture.source;
    const rootResolution = colorTextureSource.resolution;
    const rootAntialias = colorTextureSource.antialias;
    if (filters.every((filter) => !filter.enabled)) {
      filterData.skip = true;
      return;
    }
    const bounds = filterData.bounds;
    this._calculateFilterArea(instruction, bounds);
    this._calculateFilterBounds(filterData, renderer.renderTarget.rootViewPort, rootAntialias, rootResolution, 1);
    if (filterData.skip) {
      return;
    }
    const previousFilterData = this._getPreviousFilterData();
    const globalResolution = this._findFilterResolution(rootResolution);
    let offsetX = 0;
    let offsetY = 0;
    if (previousFilterData) {
      offsetX = previousFilterData.bounds.minX;
      offsetY = previousFilterData.bounds.minY;
    }
    this._calculateGlobalFrame(
      filterData,
      offsetX,
      offsetY,
      globalResolution,
      colorTextureSource.width,
      colorTextureSource.height
    );
    this._setupFilterTextures(filterData, bounds, renderer, previousFilterData);
  }
  /**
   * Applies filters to a texture.
   *
   * This method takes a texture and a list of filters, applies the filters to the texture,
   * and returns the resulting texture.
   * @param {object} params - The parameters for applying filters.
   * @param {Texture} params.texture - The texture to apply filters to.
   * @param {Filter[]} params.filters - The filters to apply.
   * @returns {Texture} The resulting texture after all filters have been applied.
   * @example
   *
   * ```ts
   * // Create a texture and a list of filters
   * const texture = new Texture(...);
   * const filters = [new BlurFilter(), new ColorMatrixFilter()];
   *
   * // Apply the filters to the texture
   * const resultTexture = filterSystem.applyToTexture({ texture, filters });
   *
   * // Use the resulting texture
   * sprite.texture = resultTexture;
   * ```
   *
   * Key Points:
   * 1. padding is not currently supported here - so clipping may occur with filters that use padding.
   * 2. If all filters are disabled or skipped, the original texture is returned.
   */
  generateFilteredTexture({ texture, filters }) {
    const filterData = this._pushFilterData();
    this._activeFilterData = filterData;
    filterData.skip = false;
    filterData.filters = filters;
    const colorTextureSource = texture.source;
    const rootResolution = colorTextureSource.resolution;
    const rootAntialias = colorTextureSource.antialias;
    if (filters.every((filter) => !filter.enabled)) {
      filterData.skip = true;
      return texture;
    }
    const bounds = filterData.bounds;
    bounds.addRect(texture.frame);
    this._calculateFilterBounds(filterData, bounds.rectangle, rootAntialias, rootResolution, 0);
    if (filterData.skip) {
      return texture;
    }
    const globalResolution = rootResolution;
    const offsetX = 0;
    const offsetY = 0;
    this._calculateGlobalFrame(
      filterData,
      offsetX,
      offsetY,
      globalResolution,
      colorTextureSource.width,
      colorTextureSource.height
    );
    filterData.outputRenderSurface = TexturePool/* TexturePool */.W.getOptimalTexture(
      bounds.width,
      bounds.height,
      filterData.resolution,
      filterData.antialias
    );
    filterData.backTexture = Texture/* Texture */.g.EMPTY;
    filterData.inputTexture = texture;
    const renderer = this.renderer;
    renderer.renderTarget.finishRenderPass();
    this._applyFiltersToTexture(filterData, true);
    const outputTexture = filterData.outputRenderSurface;
    outputTexture.source.alphaMode = "premultiplied-alpha";
    return outputTexture;
  }
  /** @internal */
  pop() {
    const renderer = this.renderer;
    const filterData = this._popFilterData();
    if (filterData.skip) {
      return;
    }
    renderer.globalUniforms.pop();
    renderer.renderTarget.finishRenderPass();
    this._activeFilterData = filterData;
    this._applyFiltersToTexture(filterData, false);
    if (filterData.blendRequired) {
      TexturePool/* TexturePool */.W.returnTexture(filterData.backTexture);
    }
    TexturePool/* TexturePool */.W.returnTexture(filterData.inputTexture);
  }
  /**
   * Copies the last render surface to a texture.
   * @param lastRenderSurface - The last render surface to copy from.
   * @param bounds - The bounds of the area to copy.
   * @param previousBounds - The previous bounds to use for offsetting the copy.
   */
  getBackTexture(lastRenderSurface, bounds, previousBounds) {
    const backgroundResolution = lastRenderSurface.colorTexture.source._resolution;
    const backTexture = TexturePool/* TexturePool */.W.getOptimalTexture(
      bounds.width,
      bounds.height,
      backgroundResolution,
      false
    );
    let x = bounds.minX;
    let y = bounds.minY;
    if (previousBounds) {
      x -= previousBounds.minX;
      y -= previousBounds.minY;
    }
    x = Math.floor(x * backgroundResolution);
    y = Math.floor(y * backgroundResolution);
    const width = Math.ceil(bounds.width * backgroundResolution);
    const height = Math.ceil(bounds.height * backgroundResolution);
    this.renderer.renderTarget.copyToTexture(
      lastRenderSurface,
      backTexture,
      { x, y },
      { width, height },
      { x: 0, y: 0 }
    );
    return backTexture;
  }
  /**
   * Applies a filter to a texture.
   * @param filter - The filter to apply.
   * @param input - The input texture.
   * @param output - The output render surface.
   * @param clear - Whether to clear the output surface before applying the filter.
   */
  applyFilter(filter, input, output, clear) {
    const renderer = this.renderer;
    const filterData = this._activeFilterData;
    const outputRenderSurface = filterData.outputRenderSurface;
    const isFinalTarget = outputRenderSurface === output;
    const rootResolution = renderer.renderTarget.rootRenderTarget.colorTexture.source._resolution;
    const resolution = this._findFilterResolution(rootResolution);
    let offsetX = 0;
    let offsetY = 0;
    if (isFinalTarget) {
      const offset = this._findPreviousFilterOffset();
      offsetX = offset.x;
      offsetY = offset.y;
    }
    this._updateFilterUniforms(input, output, filterData, offsetX, offsetY, resolution, isFinalTarget, clear);
    const filterToApply = filter.enabled ? filter : this._getPassthroughFilter();
    this._setupBindGroupsAndRender(filterToApply, input, renderer);
  }
  /**
   * Multiply _input normalized coordinates_ to this matrix to get _sprite texture normalized coordinates_.
   *
   * Use `outputMatrix * vTextureCoord` in the shader.
   * @param outputMatrix - The matrix to output to.
   * @param {Sprite} sprite - The sprite to map to.
   * @returns The mapped matrix.
   */
  calculateSpriteMatrix(outputMatrix, sprite) {
    const data = this._activeFilterData;
    const mappedMatrix = outputMatrix.set(
      data.inputTexture._source.width,
      0,
      0,
      data.inputTexture._source.height,
      data.bounds.minX,
      data.bounds.minY
    );
    const worldTransform = sprite.worldTransform.copyTo(Matrix/* Matrix */.u.shared);
    const renderGroup = sprite.renderGroup || sprite.parentRenderGroup;
    if (renderGroup && renderGroup.cacheToLocalTransform) {
      worldTransform.prepend(renderGroup.cacheToLocalTransform);
    }
    worldTransform.invert();
    mappedMatrix.prepend(worldTransform);
    mappedMatrix.scale(
      1 / sprite.texture.orig.width,
      1 / sprite.texture.orig.height
    );
    mappedMatrix.translate(sprite.anchor.x, sprite.anchor.y);
    return mappedMatrix;
  }
  destroy() {
    this._passthroughFilter?.destroy(true);
    this._passthroughFilter = null;
  }
  _getPassthroughFilter() {
    this._passthroughFilter ?? (this._passthroughFilter = new PassthroughFilter());
    return this._passthroughFilter;
  }
  /**
   * Sets up the bind groups and renders the filter.
   * @param filter - The filter to apply
   * @param input - The input texture
   * @param renderer - The renderer instance
   */
  _setupBindGroupsAndRender(filter, input, renderer) {
    if (renderer.renderPipes.uniformBatch) {
      const batchUniforms = renderer.renderPipes.uniformBatch.getUboResource(this._filterGlobalUniforms);
      this._globalFilterBindGroup.setResource(batchUniforms, 0);
    } else {
      this._globalFilterBindGroup.setResource(this._filterGlobalUniforms, 0);
    }
    this._globalFilterBindGroup.setResource(input.source, 1);
    this._globalFilterBindGroup.setResource(input.source.style, 2);
    filter.groups[0] = this._globalFilterBindGroup;
    renderer.encoder.draw({
      geometry: quadGeometry,
      shader: filter,
      state: filter._state,
      topology: "triangle-list"
    });
    if (renderer.type === types/* RendererType */.W.WEBGL) {
      renderer.renderTarget.finishRenderPass();
    }
  }
  /**
   * Sets up the filter textures including input texture and back texture if needed.
   * @param filterData - The filter data to update
   * @param bounds - The bounds for the texture
   * @param renderer - The renderer instance
   * @param previousFilterData - The previous filter data for back texture calculation
   */
  _setupFilterTextures(filterData, bounds, renderer, previousFilterData) {
    filterData.backTexture = Texture/* Texture */.g.EMPTY;
    filterData.inputTexture = TexturePool/* TexturePool */.W.getOptimalTexture(
      bounds.width,
      bounds.height,
      filterData.resolution,
      filterData.antialias
    );
    if (filterData.blendRequired) {
      renderer.renderTarget.finishRenderPass();
      const renderTarget = renderer.renderTarget.getRenderTarget(filterData.outputRenderSurface);
      filterData.backTexture = this.getBackTexture(renderTarget, bounds, previousFilterData?.bounds);
    }
    renderer.renderTarget.bind(filterData.inputTexture, true);
    renderer.globalUniforms.push({
      offset: bounds
    });
  }
  /**
   * Calculates and sets the global frame for the filter.
   * @param filterData - The filter data to update
   * @param offsetX - The X offset
   * @param offsetY - The Y offset
   * @param globalResolution - The global resolution
   * @param sourceWidth - The source texture width
   * @param sourceHeight - The source texture height
   */
  _calculateGlobalFrame(filterData, offsetX, offsetY, globalResolution, sourceWidth, sourceHeight) {
    const globalFrame = filterData.globalFrame;
    globalFrame.x = offsetX * globalResolution;
    globalFrame.y = offsetY * globalResolution;
    globalFrame.width = sourceWidth * globalResolution;
    globalFrame.height = sourceHeight * globalResolution;
  }
  /**
   * Updates the filter uniforms with the current filter state.
   * @param input - The input texture
   * @param output - The output render surface
   * @param filterData - The current filter data
   * @param offsetX - The X offset for positioning
   * @param offsetY - The Y offset for positioning
   * @param resolution - The current resolution
   * @param isFinalTarget - Whether this is the final render target
   * @param clear - Whether to clear the output surface
   */
  _updateFilterUniforms(input, output, filterData, offsetX, offsetY, resolution, isFinalTarget, clear) {
    const uniforms = this._filterGlobalUniforms.uniforms;
    const outputFrame = uniforms.uOutputFrame;
    const inputSize = uniforms.uInputSize;
    const inputPixel = uniforms.uInputPixel;
    const inputClamp = uniforms.uInputClamp;
    const globalFrame = uniforms.uGlobalFrame;
    const outputTexture = uniforms.uOutputTexture;
    if (isFinalTarget) {
      outputFrame[0] = filterData.bounds.minX - offsetX;
      outputFrame[1] = filterData.bounds.minY - offsetY;
    } else {
      outputFrame[0] = 0;
      outputFrame[1] = 0;
    }
    outputFrame[2] = input.frame.width;
    outputFrame[3] = input.frame.height;
    inputSize[0] = input.source.width;
    inputSize[1] = input.source.height;
    inputSize[2] = 1 / inputSize[0];
    inputSize[3] = 1 / inputSize[1];
    inputPixel[0] = input.source.pixelWidth;
    inputPixel[1] = input.source.pixelHeight;
    inputPixel[2] = 1 / inputPixel[0];
    inputPixel[3] = 1 / inputPixel[1];
    inputClamp[0] = 0.5 * inputPixel[2];
    inputClamp[1] = 0.5 * inputPixel[3];
    inputClamp[2] = input.frame.width * inputSize[2] - 0.5 * inputPixel[2];
    inputClamp[3] = input.frame.height * inputSize[3] - 0.5 * inputPixel[3];
    const rootTexture = this.renderer.renderTarget.rootRenderTarget.colorTexture;
    globalFrame[0] = offsetX * resolution;
    globalFrame[1] = offsetY * resolution;
    globalFrame[2] = rootTexture.source.width * resolution;
    globalFrame[3] = rootTexture.source.height * resolution;
    if (output instanceof Texture/* Texture */.g)
      output.source.resource = null;
    const renderTarget = this.renderer.renderTarget.getRenderTarget(output);
    this.renderer.renderTarget.bind(output, !!clear);
    if (output instanceof Texture/* Texture */.g) {
      outputTexture[0] = output.frame.width;
      outputTexture[1] = output.frame.height;
    } else {
      outputTexture[0] = renderTarget.width;
      outputTexture[1] = renderTarget.height;
    }
    outputTexture[2] = renderTarget.isRoot ? -1 : 1;
    this._filterGlobalUniforms.update();
  }
  /**
   * Finds the correct resolution by looking back through the filter stack.
   * @param rootResolution - The fallback root resolution to use
   * @returns The resolution from the previous filter or root resolution
   */
  _findFilterResolution(rootResolution) {
    let currentIndex = this._filterStackIndex - 1;
    while (currentIndex > 0 && this._filterStack[currentIndex].skip) {
      --currentIndex;
    }
    return currentIndex > 0 && this._filterStack[currentIndex].inputTexture ? this._filterStack[currentIndex].inputTexture.source._resolution : rootResolution;
  }
  /**
   * Finds the offset from the previous non-skipped filter in the stack.
   * @returns The offset coordinates from the previous filter
   */
  _findPreviousFilterOffset() {
    let offsetX = 0;
    let offsetY = 0;
    let lastIndex = this._filterStackIndex;
    while (lastIndex > 0) {
      lastIndex--;
      const prevFilterData = this._filterStack[lastIndex];
      if (!prevFilterData.skip) {
        offsetX = prevFilterData.bounds.minX;
        offsetY = prevFilterData.bounds.minY;
        break;
      }
    }
    return { x: offsetX, y: offsetY };
  }
  /**
   * Calculates the filter area bounds based on the instruction type.
   * @param instruction - The filter instruction
   * @param bounds - The bounds object to populate
   */
  _calculateFilterArea(instruction, bounds) {
    if (instruction.renderables) {
      getGlobalRenderableBounds(instruction.renderables, bounds);
    } else if (instruction.filterEffect.filterArea) {
      bounds.clear();
      bounds.addRect(instruction.filterEffect.filterArea);
      bounds.applyMatrix(instruction.container.worldTransform);
    } else {
      instruction.container.getFastGlobalBounds(true, bounds);
    }
    if (instruction.container) {
      const renderGroup = instruction.container.renderGroup || instruction.container.parentRenderGroup;
      const filterFrameTransform = renderGroup.cacheToLocalTransform;
      if (filterFrameTransform) {
        bounds.applyMatrix(filterFrameTransform);
      }
    }
  }
  _applyFiltersToTexture(filterData, clear) {
    const inputTexture = filterData.inputTexture;
    const bounds = filterData.bounds;
    const filters = filterData.filters;
    const firstEnabled = filterData.firstEnabledIndex;
    const lastEnabled = filterData.lastEnabledIndex;
    this._globalFilterBindGroup.setResource(inputTexture.source.style, 2);
    this._globalFilterBindGroup.setResource(filterData.backTexture.source, 3);
    if (firstEnabled === lastEnabled) {
      filters[firstEnabled].apply(this, inputTexture, filterData.outputRenderSurface, clear);
    } else {
      let flip = filterData.inputTexture;
      const tempTexture = TexturePool/* TexturePool */.W.getOptimalTexture(
        bounds.width,
        bounds.height,
        flip.source._resolution,
        false
      );
      let flop = tempTexture;
      for (let i = firstEnabled; i < lastEnabled; i++) {
        const filter = filters[i];
        if (!filter.enabled)
          continue;
        filter.apply(this, flip, flop, true);
        const t = flip;
        flip = flop;
        flop = t;
      }
      filters[lastEnabled].apply(this, flip, filterData.outputRenderSurface, clear);
      TexturePool/* TexturePool */.W.returnTexture(tempTexture);
    }
  }
  _calculateFilterBounds(filterData, viewPort, rootAntialias, rootResolution, paddingMultiplier) {
    const renderer = this.renderer;
    const bounds = filterData.bounds;
    const filters = filterData.filters;
    let resolution = Infinity;
    let padding = 0;
    let antialias = true;
    let blendRequired = false;
    let enabled = false;
    let clipToViewport = true;
    let firstEnabledIndex = -1;
    let lastEnabledIndex = -1;
    for (let i = 0; i < filters.length; i++) {
      const filter = filters[i];
      if (!filter.enabled)
        continue;
      if (firstEnabledIndex === -1)
        firstEnabledIndex = i;
      lastEnabledIndex = i;
      resolution = Math.min(resolution, filter.resolution === "inherit" ? rootResolution : filter.resolution);
      padding += filter.padding;
      if (filter.antialias === "off") {
        antialias = false;
      } else if (filter.antialias === "inherit") {
        antialias && (antialias = rootAntialias);
      }
      if (!filter.clipToViewport) {
        clipToViewport = false;
      }
      const isCompatible = !!(filter.compatibleRenderers & renderer.type);
      if (!isCompatible) {
        enabled = false;
        break;
      }
      if (filter.blendRequired && !(renderer.backBuffer?.useBackBuffer ?? true)) {
        (0,warn/* warn */.R)("Blend filter requires backBuffer on WebGL renderer to be enabled. Set `useBackBuffer: true` in the renderer options.");
        enabled = false;
        break;
      }
      enabled = true;
      blendRequired || (blendRequired = filter.blendRequired);
    }
    if (!enabled) {
      filterData.skip = true;
      return;
    }
    if (clipToViewport) {
      bounds.fitBounds(0, viewPort.width / rootResolution, 0, viewPort.height / rootResolution);
    }
    bounds.scale(resolution).ceil().scale(1 / resolution).pad((padding | 0) * paddingMultiplier);
    if (!bounds.isPositive) {
      filterData.skip = true;
      return;
    }
    filterData.antialias = antialias;
    filterData.resolution = resolution;
    filterData.blendRequired = blendRequired;
    filterData.firstEnabledIndex = firstEnabledIndex;
    filterData.lastEnabledIndex = lastEnabledIndex;
  }
  _popFilterData() {
    this._filterStackIndex--;
    return this._filterStack[this._filterStackIndex];
  }
  _getPreviousFilterData() {
    let previousFilterData;
    let index = this._filterStackIndex - 1;
    while (index > 0) {
      index--;
      previousFilterData = this._filterStack[index];
      if (!previousFilterData.skip) {
        break;
      }
    }
    return previousFilterData;
  }
  _pushFilterData() {
    let filterData = this._filterStack[this._filterStackIndex];
    if (!filterData) {
      filterData = this._filterStack[this._filterStackIndex] = new FilterData();
    }
    this._filterStackIndex++;
    return filterData;
  }
}
/** @ignore */
FilterSystem.extension = {
  type: [
    Extensions/* ExtensionType */.Ag.WebGLSystem,
    Extensions/* ExtensionType */.Ag.WebGPUSystem
  ],
  name: "filter"
};


//# sourceMappingURL=FilterSystem.mjs.map

;// ./node_modules/pixi.js/lib/filters/init.mjs




"use strict";
Extensions/* extensions */.XO.add(FilterSystem);
Extensions/* extensions */.XO.add(FilterPipe);
//# sourceMappingURL=init.mjs.map


/***/ },

/***/ 7608
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   N: () => (/* binding */ CanvasPool)
/* harmony export */ });
/* unused harmony export CanvasPoolClass */
/* harmony import */ var _environment_adapter_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(6559);
/* harmony import */ var _maths_misc_pow2_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(9939);
/* harmony import */ var _utils_pool_GlobalResourceRegistry_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(6083);




"use strict";
class CanvasPoolClass {
  constructor(canvasOptions) {
    this._canvasPool = /* @__PURE__ */ Object.create(null);
    this.canvasOptions = canvasOptions || {};
    this.enableFullScreen = false;
  }
  /**
   * Creates texture with params that were specified in pool constructor.
   * @param pixelWidth - Width of texture in pixels.
   * @param pixelHeight - Height of texture in pixels.
   */
  _createCanvasAndContext(pixelWidth, pixelHeight) {
    const canvas = _environment_adapter_mjs__WEBPACK_IMPORTED_MODULE_0__/* .DOMAdapter */ .e.get().createCanvas();
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    const context = canvas.getContext("2d");
    return { canvas, context };
  }
  /**
   * Gets a Power-of-Two render texture or fullScreen texture
   * @param minWidth - The minimum width of the render texture.
   * @param minHeight - The minimum height of the render texture.
   * @param resolution - The resolution of the render texture.
   * @returns The new render texture.
   */
  getOptimalCanvasAndContext(minWidth, minHeight, resolution = 1) {
    minWidth = Math.ceil(minWidth * resolution - 1e-6);
    minHeight = Math.ceil(minHeight * resolution - 1e-6);
    minWidth = (0,_maths_misc_pow2_mjs__WEBPACK_IMPORTED_MODULE_1__/* .nextPow2 */ .U5)(minWidth);
    minHeight = (0,_maths_misc_pow2_mjs__WEBPACK_IMPORTED_MODULE_1__/* .nextPow2 */ .U5)(minHeight);
    const key = (minWidth << 17) + (minHeight << 1);
    if (!this._canvasPool[key]) {
      this._canvasPool[key] = [];
    }
    let canvasAndContext = this._canvasPool[key].pop();
    if (!canvasAndContext) {
      canvasAndContext = this._createCanvasAndContext(minWidth, minHeight);
    }
    return canvasAndContext;
  }
  /**
   * Place a render texture back into the pool.
   * @param canvasAndContext
   */
  returnCanvasAndContext(canvasAndContext) {
    const canvas = canvasAndContext.canvas;
    const { width, height } = canvas;
    const key = (width << 17) + (height << 1);
    canvasAndContext.context.resetTransform();
    canvasAndContext.context.clearRect(0, 0, width, height);
    this._canvasPool[key].push(canvasAndContext);
  }
  clear() {
    this._canvasPool = {};
  }
}
const CanvasPool = new CanvasPoolClass();
_utils_pool_GlobalResourceRegistry_mjs__WEBPACK_IMPORTED_MODULE_2__/* .GlobalResourceRegistry */ .L.register(CanvasPool);


//# sourceMappingURL=CanvasPool.mjs.map


/***/ },

/***/ 132
(__unused_webpack___webpack_module__, __unused_webpack___webpack_exports__, __webpack_require__) {

"use strict";

// EXTERNAL MODULE: ./node_modules/pixi.js/lib/extensions/Extensions.mjs
var Extensions = __webpack_require__(8507);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/graphics/shared/GraphicsContextSystem.mjs + 16 modules
var GraphicsContextSystem = __webpack_require__(5659);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/state/State.mjs
var State = __webpack_require__(7547);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/utils/pool/PoolGroup.mjs + 1 modules
var PoolGroup = __webpack_require__(1822);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/graphics/gpu/colorToUniform.mjs
var colorToUniform = __webpack_require__(2760);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/graphics/shared/BatchableGraphics.mjs
var BatchableGraphics = __webpack_require__(6954);
;// ./node_modules/pixi.js/lib/scene/graphics/shared/GraphicsPipe.mjs






"use strict";
class GraphicsGpuData {
  constructor() {
    this.batches = [];
    this.batched = false;
  }
  destroy() {
    this.batches.forEach((batch) => {
      PoolGroup/* BigPool */.Z.return(batch);
    });
    this.batches.length = 0;
  }
}
class GraphicsPipe {
  constructor(renderer, adaptor) {
    this.state = State/* State */.U.for2d();
    this.renderer = renderer;
    this._adaptor = adaptor;
    this.renderer.runners.contextChange.add(this);
  }
  contextChange() {
    this._adaptor.contextChange(this.renderer);
  }
  validateRenderable(graphics) {
    const context = graphics.context;
    const wasBatched = !!graphics._gpuData;
    const gpuContext = this.renderer.graphicsContext.updateGpuContext(context);
    if (gpuContext.isBatchable || wasBatched !== gpuContext.isBatchable) {
      return true;
    }
    return false;
  }
  addRenderable(graphics, instructionSet) {
    const gpuContext = this.renderer.graphicsContext.updateGpuContext(graphics.context);
    if (graphics.didViewUpdate) {
      this._rebuild(graphics);
    }
    if (gpuContext.isBatchable) {
      this._addToBatcher(graphics, instructionSet);
    } else {
      this.renderer.renderPipes.batch.break(instructionSet);
      instructionSet.add(graphics);
    }
  }
  updateRenderable(graphics) {
    const gpuData = this._getGpuDataForRenderable(graphics);
    const batches = gpuData.batches;
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      batch._batcher.updateElement(batch);
    }
  }
  execute(graphics) {
    if (!graphics.isRenderable)
      return;
    const renderer = this.renderer;
    const context = graphics.context;
    const contextSystem = renderer.graphicsContext;
    if (!contextSystem.getGpuContext(context).batches.length) {
      return;
    }
    const shader = context.customShader || this._adaptor.shader;
    this.state.blendMode = graphics.groupBlendMode;
    const localUniforms = shader.resources.localUniforms.uniforms;
    localUniforms.uTransformMatrix = graphics.groupTransform;
    localUniforms.uRound = renderer._roundPixels | graphics._roundPixels;
    (0,colorToUniform/* color32BitToUniform */.V)(
      graphics.groupColorAlpha,
      localUniforms.uColor,
      0
    );
    this._adaptor.execute(this, graphics);
  }
  _rebuild(graphics) {
    const gpuData = this._getGpuDataForRenderable(graphics);
    const gpuContext = this.renderer.graphicsContext.updateGpuContext(graphics.context);
    gpuData.destroy();
    if (gpuContext.isBatchable) {
      this._updateBatchesForRenderable(graphics, gpuData);
    }
  }
  _addToBatcher(graphics, instructionSet) {
    const batchPipe = this.renderer.renderPipes.batch;
    const batches = this._getGpuDataForRenderable(graphics).batches;
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      batchPipe.addToBatch(batch, instructionSet);
    }
  }
  _getGpuDataForRenderable(graphics) {
    return graphics._gpuData[this.renderer.uid] || this._initGpuDataForRenderable(graphics);
  }
  _initGpuDataForRenderable(graphics) {
    const gpuData = new GraphicsGpuData();
    graphics._gpuData[this.renderer.uid] = gpuData;
    return gpuData;
  }
  _updateBatchesForRenderable(graphics, gpuData) {
    const context = graphics.context;
    const gpuContext = this.renderer.graphicsContext.getGpuContext(context);
    const roundPixels = this.renderer._roundPixels | graphics._roundPixels;
    gpuData.batches = gpuContext.batches.map((batch) => {
      const batchClone = PoolGroup/* BigPool */.Z.get(BatchableGraphics/* BatchableGraphics */.G);
      batch.copyTo(batchClone);
      batchClone.renderable = graphics;
      batchClone.roundPixels = roundPixels;
      return batchClone;
    });
  }
  destroy() {
    this.renderer = null;
    this._adaptor.destroy();
    this._adaptor = null;
    this.state = null;
  }
}
/** @ignore */
GraphicsPipe.extension = {
  type: [
    Extensions/* ExtensionType */.Ag.WebGLPipes,
    Extensions/* ExtensionType */.Ag.WebGPUPipes,
    Extensions/* ExtensionType */.Ag.CanvasPipes
  ],
  name: "graphics"
};


//# sourceMappingURL=GraphicsPipe.mjs.map

;// ./node_modules/pixi.js/lib/scene/graphics/init.mjs




"use strict";
Extensions/* extensions */.XO.add(GraphicsPipe);
Extensions/* extensions */.XO.add(GraphicsContextSystem/* GraphicsContextSystem */.GH);
//# sourceMappingURL=init.mjs.map


/***/ },

/***/ 6954
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   G: () => (/* binding */ BatchableGraphics)
/* harmony export */ });
/* harmony import */ var _maths_matrix_Matrix_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9313);
/* harmony import */ var _container_utils_multiplyHexColors_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4676);



"use strict";
const identityMatrix = new _maths_matrix_Matrix_mjs__WEBPACK_IMPORTED_MODULE_0__/* .Matrix */ .u();
class BatchableGraphics {
  constructor() {
    this.packAsQuad = false;
    this.batcherName = "default";
    this.topology = "triangle-list";
    this.applyTransform = true;
    this.roundPixels = 0;
    this._batcher = null;
    this._batch = null;
  }
  get uvs() {
    return this.geometryData.uvs;
  }
  get positions() {
    return this.geometryData.vertices;
  }
  get indices() {
    return this.geometryData.indices;
  }
  get blendMode() {
    if (this.renderable && this.applyTransform) {
      return this.renderable.groupBlendMode;
    }
    return "normal";
  }
  get color() {
    const rgb = this.baseColor;
    const bgr = rgb >> 16 | rgb & 65280 | (rgb & 255) << 16;
    const renderable = this.renderable;
    if (renderable) {
      return (0,_container_utils_multiplyHexColors_mjs__WEBPACK_IMPORTED_MODULE_1__/* .multiplyHexColors */ .u)(bgr, renderable.groupColor) + (this.alpha * renderable.groupAlpha * 255 << 24);
    }
    return bgr + (this.alpha * 255 << 24);
  }
  get transform() {
    return this.renderable?.groupTransform || identityMatrix;
  }
  copyTo(gpuBuffer) {
    gpuBuffer.indexOffset = this.indexOffset;
    gpuBuffer.indexSize = this.indexSize;
    gpuBuffer.attributeOffset = this.attributeOffset;
    gpuBuffer.attributeSize = this.attributeSize;
    gpuBuffer.baseColor = this.baseColor;
    gpuBuffer.alpha = this.alpha;
    gpuBuffer.texture = this.texture;
    gpuBuffer.geometryData = this.geometryData;
    gpuBuffer.topology = this.topology;
  }
  reset() {
    this.applyTransform = true;
    this.renderable = null;
    this.topology = "triangle-list";
  }
  destroy() {
    this.renderable = null;
    this.texture = null;
    this.geometryData = null;
    this._batcher = null;
    this._batch = null;
  }
}


//# sourceMappingURL=BatchableGraphics.mjs.map


/***/ },

/***/ 9516
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  T: () => (/* binding */ GraphicsContext)
});

// EXTERNAL MODULE: ./node_modules/eventemitter3/index.mjs
var eventemitter3 = __webpack_require__(4486);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/color/Color.mjs + 2 modules
var Color = __webpack_require__(3556);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/maths/matrix/Matrix.mjs
var Matrix = __webpack_require__(9313);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/maths/point/Point.mjs
var Point = __webpack_require__(5101);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/texture/Texture.mjs + 2 modules
var Texture = __webpack_require__(226);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/utils/data/uid.mjs
var uid = __webpack_require__(133);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/utils/logging/deprecation.mjs
var deprecation = __webpack_require__(4670);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/container/bounds/Bounds.mjs
var Bounds = __webpack_require__(9636);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/utils/logging/warn.mjs
var warn = __webpack_require__(268);
// EXTERNAL MODULE: ./node_modules/parse-svg-path/index.js
var parse_svg_path = __webpack_require__(8133);
;// ./node_modules/pixi.js/lib/scene/graphics/shared/svg/parseSVGPath.mjs



"use strict";
function parseSVGPath(svgPath, path) {
  const commands = parse_svg_path(svgPath);
  const subpaths = [];
  let currentSubPath = null;
  let lastX = 0;
  let lastY = 0;
  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];
    const type = command[0];
    const data = command;
    switch (type) {
      case "M":
        lastX = data[1];
        lastY = data[2];
        path.moveTo(lastX, lastY);
        break;
      case "m":
        lastX += data[1];
        lastY += data[2];
        path.moveTo(lastX, lastY);
        break;
      case "H":
        lastX = data[1];
        path.lineTo(lastX, lastY);
        break;
      case "h":
        lastX += data[1];
        path.lineTo(lastX, lastY);
        break;
      case "V":
        lastY = data[1];
        path.lineTo(lastX, lastY);
        break;
      case "v":
        lastY += data[1];
        path.lineTo(lastX, lastY);
        break;
      case "L":
        lastX = data[1];
        lastY = data[2];
        path.lineTo(lastX, lastY);
        break;
      case "l":
        lastX += data[1];
        lastY += data[2];
        path.lineTo(lastX, lastY);
        break;
      case "C":
        lastX = data[5];
        lastY = data[6];
        path.bezierCurveTo(
          data[1],
          data[2],
          // First control point
          data[3],
          data[4],
          // Second control point
          lastX,
          lastY
          // End point
        );
        break;
      case "c":
        path.bezierCurveTo(
          lastX + data[1],
          lastY + data[2],
          // First control point
          lastX + data[3],
          lastY + data[4],
          // Second control point
          lastX + data[5],
          lastY + data[6]
          // End point
        );
        lastX += data[5];
        lastY += data[6];
        break;
      case "S":
        lastX = data[3];
        lastY = data[4];
        path.bezierCurveToShort(
          data[1],
          data[2],
          // Control point
          lastX,
          lastY
          // End point
        );
        break;
      case "s":
        path.bezierCurveToShort(
          lastX + data[1],
          lastY + data[2],
          // Control point
          lastX + data[3],
          lastY + data[4]
          // End point
        );
        lastX += data[3];
        lastY += data[4];
        break;
      case "Q":
        lastX = data[3];
        lastY = data[4];
        path.quadraticCurveTo(
          data[1],
          data[2],
          // Control point
          lastX,
          lastY
          // End point
        );
        break;
      case "q":
        path.quadraticCurveTo(
          lastX + data[1],
          lastY + data[2],
          // Control point
          lastX + data[3],
          lastY + data[4]
          // End point
        );
        lastX += data[3];
        lastY += data[4];
        break;
      case "T":
        lastX = data[1];
        lastY = data[2];
        path.quadraticCurveToShort(
          lastX,
          lastY
          // End point
        );
        break;
      case "t":
        lastX += data[1];
        lastY += data[2];
        path.quadraticCurveToShort(
          lastX,
          lastY
          // End point
        );
        break;
      case "A":
        lastX = data[6];
        lastY = data[7];
        path.arcToSvg(
          data[1],
          // rx
          data[2],
          // ry
          data[3],
          // x-axis-rotation
          data[4],
          // large-arc-flag
          data[5],
          // sweep-flag
          lastX,
          lastY
          // End point
        );
        break;
      case "a":
        lastX += data[6];
        lastY += data[7];
        path.arcToSvg(
          data[1],
          // rx
          data[2],
          // ry
          data[3],
          // x-axis-rotation
          data[4],
          // large-arc-flag
          data[5],
          // sweep-flag
          lastX,
          lastY
          // End point
        );
        break;
      case "Z":
      case "z":
        path.closePath();
        if (subpaths.length > 0) {
          currentSubPath = subpaths.pop();
          if (currentSubPath) {
            lastX = currentSubPath.startX;
            lastY = currentSubPath.startY;
          } else {
            lastX = 0;
            lastY = 0;
          }
        }
        currentSubPath = null;
        break;
      default:
        (0,warn/* warn */.R)(`Unknown SVG path command: ${type}`);
    }
    if (type !== "Z" && type !== "z") {
      if (currentSubPath === null) {
        currentSubPath = { startX: lastX, startY: lastY };
        subpaths.push(currentSubPath);
      }
    }
  }
  return path;
}


//# sourceMappingURL=parseSVGPath.mjs.map

// EXTERNAL MODULE: ./node_modules/pixi.js/lib/maths/shapes/Rectangle.mjs
var Rectangle = __webpack_require__(9252);
;// ./node_modules/pixi.js/lib/maths/shapes/Circle.mjs


"use strict";
class Circle {
  /**
   * @param x - The X coordinate of the center of this circle
   * @param y - The Y coordinate of the center of this circle
   * @param radius - The radius of the circle
   */
  constructor(x = 0, y = 0, radius = 0) {
    /**
     * The type of the object, mainly used to avoid `instanceof` checks.
     * @example
     * ```ts
     * // Check shape type
     * const shape = new Circle(0, 0, 50);
     * console.log(shape.type); // 'circle'
     *
     * // Use in type guards
     * if (shape.type === 'circle') {
     *     console.log(shape.radius);
     * }
     * ```
     * @remarks
     * - Used for shape type checking
     * - More efficient than instanceof
     * - Read-only property
     * @readonly
     * @default 'circle'
     * @see {@link SHAPE_PRIMITIVE} For all shape types
     * @see {@link ShapePrimitive} For shape interface
     */
    this.type = "circle";
    this.x = x;
    this.y = y;
    this.radius = radius;
  }
  /**
   * Creates a clone of this Circle instance.
   * @example
   * ```ts
   * // Basic circle cloning
   * const original = new Circle(100, 100, 50);
   * const copy = original.clone();
   *
   * // Clone and modify
   * const modified = original.clone();
   * modified.radius = 75;
   *
   * // Verify independence
   * console.log(original.radius); // 50
   * console.log(modified.radius); // 75
   * ```
   * @returns A copy of the Circle
   * @see {@link Circle.copyFrom} For copying into existing circle
   * @see {@link Circle.copyTo} For copying to another circle
   */
  clone() {
    return new Circle(this.x, this.y, this.radius);
  }
  /**
   * Checks whether the x and y coordinates given are contained within this circle.
   *
   * Uses the distance formula to determine if a point is inside the circle's radius.
   *
   * Commonly used for hit testing in PixiJS events and graphics.
   * @example
   * ```ts
   * // Basic containment check
   * const circle = new Circle(100, 100, 50);
   * const isInside = circle.contains(120, 120);
   *
   * // Check mouse position
   * const circle = new Circle(0, 0, 100);
   * container.hitArea = circle;
   * container.on('pointermove', (e) => {
   *     // only called if pointer is within circle
   * });
   * ```
   * @param x - The X coordinate of the point to test
   * @param y - The Y coordinate of the point to test
   * @returns Whether the x/y coordinates are within this Circle
   * @see {@link Circle.strokeContains} For checking stroke intersection
   * @see {@link Circle.getBounds} For getting bounding box
   */
  contains(x, y) {
    if (this.radius <= 0)
      return false;
    const r2 = this.radius * this.radius;
    let dx = this.x - x;
    let dy = this.y - y;
    dx *= dx;
    dy *= dy;
    return dx + dy <= r2;
  }
  /**
   * Checks whether the x and y coordinates given are contained within this circle including the stroke.
   * @example
   * ```ts
   * // Basic stroke check
   * const circle = new Circle(100, 100, 50);
   * const isOnStroke = circle.strokeContains(150, 100, 4); // 4px line width
   *
   * // Check with different alignments
   * const innerStroke = circle.strokeContains(150, 100, 4, 1);   // Inside
   * const centerStroke = circle.strokeContains(150, 100, 4, 0.5); // Centered
   * const outerStroke = circle.strokeContains(150, 100, 4, 0);   // Outside
   * ```
   * @param x - The X coordinate of the point to test
   * @param y - The Y coordinate of the point to test
   * @param width - The width of the line to check
   * @param alignment - The alignment of the stroke, 0.5 by default
   * @returns Whether the x/y coordinates are within this Circle's stroke
   * @see {@link Circle.contains} For checking fill containment
   * @see {@link Circle.getBounds} For getting stroke bounds
   */
  strokeContains(x, y, width, alignment = 0.5) {
    if (this.radius === 0)
      return false;
    const dx = this.x - x;
    const dy = this.y - y;
    const radius = this.radius;
    const outerWidth = (1 - alignment) * width;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= radius + outerWidth && distance > radius - (width - outerWidth);
  }
  /**
   * Returns the framing rectangle of the circle as a Rectangle object.
   * @example
   * ```ts
   * // Basic bounds calculation
   * const circle = new Circle(100, 100, 50);
   * const bounds = circle.getBounds();
   * // bounds: x=50, y=50, width=100, height=100
   *
   * // Reuse existing rectangle
   * const rect = new Rectangle();
   * circle.getBounds(rect);
   * ```
   * @param out - Optional Rectangle object to store the result
   * @returns The framing rectangle
   * @see {@link Rectangle} For rectangle properties
   * @see {@link Circle.contains} For point containment
   */
  getBounds(out) {
    out || (out = new Rectangle/* Rectangle */.M());
    out.x = this.x - this.radius;
    out.y = this.y - this.radius;
    out.width = this.radius * 2;
    out.height = this.radius * 2;
    return out;
  }
  /**
   * Copies another circle to this one.
   * @example
   * ```ts
   * // Basic copying
   * const source = new Circle(100, 100, 50);
   * const target = new Circle();
   * target.copyFrom(source);
   * ```
   * @param circle - The circle to copy from
   * @returns Returns itself
   * @see {@link Circle.copyTo} For copying to another circle
   * @see {@link Circle.clone} For creating new circle copy
   */
  copyFrom(circle) {
    this.x = circle.x;
    this.y = circle.y;
    this.radius = circle.radius;
    return this;
  }
  /**
   * Copies this circle to another one.
   * @example
   * ```ts
   * // Basic copying
   * const source = new Circle(100, 100, 50);
   * const target = new Circle();
   * source.copyTo(target);
   * ```
   * @param circle - The circle to copy to
   * @returns Returns given parameter
   * @see {@link Circle.copyFrom} For copying from another circle
   * @see {@link Circle.clone} For creating new circle copy
   */
  copyTo(circle) {
    circle.copyFrom(this);
    return circle;
  }
  toString() {
    return `[pixi.js/math:Circle x=${this.x} y=${this.y} radius=${this.radius}]`;
  }
}


//# sourceMappingURL=Circle.mjs.map

;// ./node_modules/pixi.js/lib/maths/shapes/Ellipse.mjs


"use strict";
class Ellipse {
  /**
   * @param x - The X coordinate of the center of this ellipse
   * @param y - The Y coordinate of the center of this ellipse
   * @param halfWidth - The half width of this ellipse
   * @param halfHeight - The half height of this ellipse
   */
  constructor(x = 0, y = 0, halfWidth = 0, halfHeight = 0) {
    /**
     * The type of the object, mainly used to avoid `instanceof` checks
     * @example
     * ```ts
     * // Check shape type
     * const shape = new Ellipse(0, 0, 50, 25);
     * console.log(shape.type); // 'ellipse'
     *
     * // Use in type guards
     * if (shape.type === 'ellipse') {
     *     console.log(shape.halfWidth, shape.halfHeight);
     * }
     * ```
     * @readonly
     * @default 'ellipse'
     * @see {@link SHAPE_PRIMITIVE} For all shape types
     */
    this.type = "ellipse";
    this.x = x;
    this.y = y;
    this.halfWidth = halfWidth;
    this.halfHeight = halfHeight;
  }
  /**
   * Creates a clone of this Ellipse instance.
   * @example
   * ```ts
   * // Basic cloning
   * const original = new Ellipse(100, 100, 50, 25);
   * const copy = original.clone();
   *
   * // Clone and modify
   * const modified = original.clone();
   * modified.halfWidth *= 2;
   * modified.halfHeight *= 2;
   *
   * // Verify independence
   * console.log(original.halfWidth);  // 50
   * console.log(modified.halfWidth);  // 100
   * ```
   * @returns A copy of the ellipse
   * @see {@link Ellipse.copyFrom} For copying into existing ellipse
   * @see {@link Ellipse.copyTo} For copying to another ellipse
   */
  clone() {
    return new Ellipse(this.x, this.y, this.halfWidth, this.halfHeight);
  }
  /**
   * Checks whether the x and y coordinates given are contained within this ellipse.
   * Uses normalized coordinates and the ellipse equation to determine containment.
   * @example
   * ```ts
   * // Basic containment check
   * const ellipse = new Ellipse(100, 100, 50, 25);
   * const isInside = ellipse.contains(120, 110);
   * ```
   * @remarks
   * - Uses ellipse equation (x²/a² + y²/b² ≤ 1)
   * - Returns false if dimensions are 0 or negative
   * - Normalized to center (0,0) for calculation
   * @param x - The X coordinate of the point to test
   * @param y - The Y coordinate of the point to test
   * @returns Whether the x/y coords are within this ellipse
   * @see {@link Ellipse.strokeContains} For checking stroke intersection
   * @see {@link Ellipse.getBounds} For getting containing rectangle
   */
  contains(x, y) {
    if (this.halfWidth <= 0 || this.halfHeight <= 0) {
      return false;
    }
    let normx = (x - this.x) / this.halfWidth;
    let normy = (y - this.y) / this.halfHeight;
    normx *= normx;
    normy *= normy;
    return normx + normy <= 1;
  }
  /**
   * Checks whether the x and y coordinates given are contained within this ellipse including stroke.
   * @example
   * ```ts
   * // Basic stroke check
   * const ellipse = new Ellipse(100, 100, 50, 25);
   * const isOnStroke = ellipse.strokeContains(150, 100, 4); // 4px line width
   *
   * // Check with different alignments
   * const innerStroke = ellipse.strokeContains(150, 100, 4, 1);   // Inside
   * const centerStroke = ellipse.strokeContains(150, 100, 4, 0.5); // Centered
   * const outerStroke = ellipse.strokeContains(150, 100, 4, 0);   // Outside
   * ```
   * @remarks
   * - Uses normalized ellipse equations
   * - Considers stroke alignment
   * - Returns false if dimensions are 0
   * @param x - The X coordinate of the point to test
   * @param y - The Y coordinate of the point to test
   * @param strokeWidth - The width of the line to check
   * @param alignment - The alignment of the stroke (1 = inner, 0.5 = centered, 0 = outer)
   * @returns Whether the x/y coords are within this ellipse's stroke
   * @see {@link Ellipse.contains} For checking fill containment
   * @see {@link Ellipse.getBounds} For getting stroke bounds
   */
  strokeContains(x, y, strokeWidth, alignment = 0.5) {
    const { halfWidth, halfHeight } = this;
    if (halfWidth <= 0 || halfHeight <= 0) {
      return false;
    }
    const strokeOuterWidth = strokeWidth * (1 - alignment);
    const strokeInnerWidth = strokeWidth - strokeOuterWidth;
    const innerHorizontal = halfWidth - strokeInnerWidth;
    const innerVertical = halfHeight - strokeInnerWidth;
    const outerHorizontal = halfWidth + strokeOuterWidth;
    const outerVertical = halfHeight + strokeOuterWidth;
    const normalizedX = x - this.x;
    const normalizedY = y - this.y;
    const innerEllipse = normalizedX * normalizedX / (innerHorizontal * innerHorizontal) + normalizedY * normalizedY / (innerVertical * innerVertical);
    const outerEllipse = normalizedX * normalizedX / (outerHorizontal * outerHorizontal) + normalizedY * normalizedY / (outerVertical * outerVertical);
    return innerEllipse > 1 && outerEllipse <= 1;
  }
  /**
   * Returns the framing rectangle of the ellipse as a Rectangle object.
   * @example
   * ```ts
   * // Basic bounds calculation
   * const ellipse = new Ellipse(100, 100, 50, 25);
   * const bounds = ellipse.getBounds();
   * // bounds: x=50, y=75, width=100, height=50
   *
   * // Reuse existing rectangle
   * const rect = new Rectangle();
   * ellipse.getBounds(rect);
   * ```
   * @remarks
   * - Creates Rectangle if none provided
   * - Top-left is (x-halfWidth, y-halfHeight)
   * - Width is halfWidth * 2
   * - Height is halfHeight * 2
   * @param out - Optional Rectangle object to store the result
   * @returns The framing rectangle
   * @see {@link Rectangle} For rectangle properties
   * @see {@link Ellipse.contains} For checking if a point is inside
   */
  getBounds(out) {
    out || (out = new Rectangle/* Rectangle */.M());
    out.x = this.x - this.halfWidth;
    out.y = this.y - this.halfHeight;
    out.width = this.halfWidth * 2;
    out.height = this.halfHeight * 2;
    return out;
  }
  /**
   * Copies another ellipse to this one.
   * @example
   * ```ts
   * // Basic copying
   * const source = new Ellipse(100, 100, 50, 25);
   * const target = new Ellipse();
   * target.copyFrom(source);
   * ```
   * @param ellipse - The ellipse to copy from
   * @returns Returns itself
   * @see {@link Ellipse.copyTo} For copying to another ellipse
   * @see {@link Ellipse.clone} For creating new ellipse copy
   */
  copyFrom(ellipse) {
    this.x = ellipse.x;
    this.y = ellipse.y;
    this.halfWidth = ellipse.halfWidth;
    this.halfHeight = ellipse.halfHeight;
    return this;
  }
  /**
   * Copies this ellipse to another one.
   * @example
   * ```ts
   * // Basic copying
   * const source = new Ellipse(100, 100, 50, 25);
   * const target = new Ellipse();
   * source.copyTo(target);
   * ```
   * @param ellipse - The ellipse to copy to
   * @returns Returns given parameter
   * @see {@link Ellipse.copyFrom} For copying from another ellipse
   * @see {@link Ellipse.clone} For creating new ellipse copy
   */
  copyTo(ellipse) {
    ellipse.copyFrom(this);
    return ellipse;
  }
  toString() {
    return `[pixi.js/math:Ellipse x=${this.x} y=${this.y} halfWidth=${this.halfWidth} halfHeight=${this.halfHeight}]`;
  }
}


//# sourceMappingURL=Ellipse.mjs.map

;// ./node_modules/pixi.js/lib/maths/misc/squaredDistanceToLineSegment.mjs

function squaredDistanceToLineSegment(x, y, x1, y1, x2, y2) {
  const a = x - x1;
  const b = y - y1;
  const c = x2 - x1;
  const d = y2 - y1;
  const dot = a * c + b * d;
  const lenSq = c * c + d * d;
  let param = -1;
  if (lenSq !== 0) {
    param = dot / lenSq;
  }
  let xx;
  let yy;
  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * c;
    yy = y1 + param * d;
  }
  const dx = x - xx;
  const dy = y - yy;
  return dx * dx + dy * dy;
}


//# sourceMappingURL=squaredDistanceToLineSegment.mjs.map

;// ./node_modules/pixi.js/lib/maths/shapes/Polygon.mjs




"use strict";
let tempRect;
let tempRect2;
class Polygon {
  /**
   * @param points - This can be an array of Points
   *  that form the polygon, a flat array of numbers that will be interpreted as [x,y, x,y, ...], or
   *  the arguments passed can be all the points of the polygon e.g.
   *  `new Polygon(new Point(), new Point(), ...)`, or the arguments passed can be flat
   *  x,y values e.g. `new Polygon(x,y, x,y, x,y, ...)` where `x` and `y` are Numbers.
   */
  constructor(...points) {
    /**
     * The type of the object, mainly used to avoid `instanceof` checks
     * @example
     * ```ts
     * // Check shape type
     * const shape = new Polygon([0, 0, 100, 0, 50, 100]);
     * console.log(shape.type); // 'polygon'
     *
     * // Use in type guards
     * if (shape.type === 'polygon') {
     *     // TypeScript knows this is a Polygon
     *     console.log(shape.points.length);
     * }
     * ```
     * @readonly
     * @default 'polygon'
     * @see {@link SHAPE_PRIMITIVE} For all shape types
     */
    this.type = "polygon";
    let flat = Array.isArray(points[0]) ? points[0] : points;
    if (typeof flat[0] !== "number") {
      const p = [];
      for (let i = 0, il = flat.length; i < il; i++) {
        p.push(flat[i].x, flat[i].y);
      }
      flat = p;
    }
    this.points = flat;
    this.closePath = true;
  }
  /**
   * Determines whether the polygon's points are arranged in a clockwise direction.
   * Uses the shoelace formula (surveyor's formula) to calculate the signed area.
   *
   * A positive area indicates clockwise winding, while negative indicates counter-clockwise.
   *
   * The formula sums up the cross products of adjacent vertices:
   * For each pair of adjacent points (x1,y1) and (x2,y2), we calculate (x1*y2 - x2*y1)
   * The final sum divided by 2 gives the signed area - positive for clockwise.
   * @example
   * ```ts
   * // Check polygon winding
   * const polygon = new Polygon([0, 0, 100, 0, 50, 100]);
   * console.log(polygon.isClockwise()); // Check direction
   *
   * // Use in path construction
   * const hole = new Polygon([25, 25, 75, 25, 75, 75, 25, 75]);
   * if (hole.isClockwise() === shape.isClockwise()) {
   *     hole.points.reverse(); // Reverse for proper hole winding
   * }
   * ```
   * @returns `true` if the polygon's points are arranged clockwise, `false` if counter-clockwise
   */
  isClockwise() {
    let area = 0;
    const points = this.points;
    const length = points.length;
    for (let i = 0; i < length; i += 2) {
      const x1 = points[i];
      const y1 = points[i + 1];
      const x2 = points[(i + 2) % length];
      const y2 = points[(i + 3) % length];
      area += (x2 - x1) * (y2 + y1);
    }
    return area < 0;
  }
  /**
   * Checks if this polygon completely contains another polygon.
   * Used for detecting holes in shapes, like when parsing SVG paths.
   * @example
   * ```ts
   * // Basic containment check
   * const outerSquare = new Polygon([0,0, 100,0, 100,100, 0,100]); // A square
   * const innerSquare = new Polygon([25,25, 75,25, 75,75, 25,75]); // A smaller square inside
   *
   * outerSquare.containsPolygon(innerSquare); // Returns true
   * innerSquare.containsPolygon(outerSquare); // Returns false
   * ```
   * @remarks
   * - Uses bounds check for quick rejection
   * - Tests all points for containment
   * @param polygon - The polygon to test for containment
   * @returns True if this polygon completely contains the other polygon
   * @see {@link Polygon.contains} For single point testing
   * @see {@link Polygon.getBounds} For bounds calculation
   */
  containsPolygon(polygon) {
    const thisBounds = this.getBounds(tempRect);
    const otherBounds = polygon.getBounds(tempRect2);
    if (!thisBounds.containsRect(otherBounds)) {
      return false;
    }
    const points = polygon.points;
    for (let i = 0; i < points.length; i += 2) {
      const x = points[i];
      const y = points[i + 1];
      if (!this.contains(x, y)) {
        return false;
      }
    }
    return true;
  }
  /**
   * Creates a clone of this polygon.
   * @example
   * ```ts
   * // Basic cloning
   * const original = new Polygon([0, 0, 100, 0, 50, 100]);
   * const copy = original.clone();
   *
   * // Clone and modify
   * const modified = original.clone();
   * modified.points[0] = 10; // Modify first x coordinate
   * ```
   * @returns A copy of the polygon
   * @see {@link Polygon.copyFrom} For copying into existing polygon
   * @see {@link Polygon.copyTo} For copying to another polygon
   */
  clone() {
    const points = this.points.slice();
    const polygon = new Polygon(points);
    polygon.closePath = this.closePath;
    return polygon;
  }
  /**
   * Checks whether the x and y coordinates passed to this function are contained within this polygon.
   * Uses raycasting algorithm for point-in-polygon testing.
   * @example
   * ```ts
   * // Basic containment check
   * const polygon = new Polygon([0, 0, 100, 0, 50, 100]);
   * const isInside = polygon.contains(25, 25); // true
   * ```
   * @param x - The X coordinate of the point to test
   * @param y - The Y coordinate of the point to test
   * @returns Whether the x/y coordinates are within this polygon
   * @see {@link Polygon.strokeContains} For checking stroke intersection
   * @see {@link Polygon.containsPolygon} For polygon-in-polygon testing
   */
  contains(x, y) {
    let inside = false;
    const length = this.points.length / 2;
    for (let i = 0, j = length - 1; i < length; j = i++) {
      const xi = this.points[i * 2];
      const yi = this.points[i * 2 + 1];
      const xj = this.points[j * 2];
      const yj = this.points[j * 2 + 1];
      const intersect = yi > y !== yj > y && x < (xj - xi) * ((y - yi) / (yj - yi)) + xi;
      if (intersect) {
        inside = !inside;
      }
    }
    return inside;
  }
  /**
   * Checks whether the x and y coordinates given are contained within this polygon including the stroke.
   * @example
   * ```ts
   * // Basic stroke check
   * const polygon = new Polygon([0, 0, 100, 0, 50, 100]);
   * const isOnStroke = polygon.strokeContains(25, 25, 4); // 4px line width
   *
   * // Check with different alignments
   * const innerStroke = polygon.strokeContains(25, 25, 4, 1);   // Inside
   * const centerStroke = polygon.strokeContains(25, 25, 4, 0.5); // Centered
   * const outerStroke = polygon.strokeContains(25, 25, 4, 0);   // Outside
   * ```
   * @param x - The X coordinate of the point to test
   * @param y - The Y coordinate of the point to test
   * @param strokeWidth - The width of the line to check
   * @param alignment - The alignment of the stroke (1 = inner, 0.5 = centered, 0 = outer)
   * @returns Whether the x/y coordinates are within this polygon's stroke
   * @see {@link Polygon.contains} For checking fill containment
   * @see {@link Polygon.getBounds} For getting stroke bounds
   */
  strokeContains(x, y, strokeWidth, alignment = 0.5) {
    const strokeWidthSquared = strokeWidth * strokeWidth;
    const rightWidthSquared = strokeWidthSquared * (1 - alignment);
    const leftWidthSquared = strokeWidthSquared - rightWidthSquared;
    const { points } = this;
    const iterationLength = points.length - (this.closePath ? 0 : 2);
    for (let i = 0; i < iterationLength; i += 2) {
      const x1 = points[i];
      const y1 = points[i + 1];
      const x2 = points[(i + 2) % points.length];
      const y2 = points[(i + 3) % points.length];
      const distanceSquared = squaredDistanceToLineSegment(x, y, x1, y1, x2, y2);
      const sign = Math.sign((x2 - x1) * (y - y1) - (y2 - y1) * (x - x1));
      if (distanceSquared <= (sign < 0 ? leftWidthSquared : rightWidthSquared)) {
        return true;
      }
    }
    return false;
  }
  /**
   * Returns the framing rectangle of the polygon as a Rectangle object.
   * @example
   * ```ts
   * // Basic bounds calculation
   * const polygon = new Polygon([0, 0, 100, 0, 50, 100]);
   * const bounds = polygon.getBounds();
   * // bounds: x=0, y=0, width=100, height=100
   *
   * // Reuse existing rectangle
   * const rect = new Rectangle();
   * polygon.getBounds(rect);
   * ```
   * @param out - Optional rectangle to store the result
   * @returns The framing rectangle
   * @see {@link Rectangle} For rectangle properties
   * @see {@link Polygon.contains} For checking if a point is inside
   */
  getBounds(out) {
    out || (out = new Rectangle/* Rectangle */.M());
    const points = this.points;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0, n = points.length; i < n; i += 2) {
      const x = points[i];
      const y = points[i + 1];
      minX = x < minX ? x : minX;
      maxX = x > maxX ? x : maxX;
      minY = y < minY ? y : minY;
      maxY = y > maxY ? y : maxY;
    }
    out.x = minX;
    out.width = maxX - minX;
    out.y = minY;
    out.height = maxY - minY;
    return out;
  }
  /**
   * Copies another polygon to this one.
   * @example
   * ```ts
   * // Basic copying
   * const source = new Polygon([0, 0, 100, 0, 50, 100]);
   * const target = new Polygon();
   * target.copyFrom(source);
   * ```
   * @param polygon - The polygon to copy from
   * @returns Returns itself
   * @see {@link Polygon.copyTo} For copying to another polygon
   * @see {@link Polygon.clone} For creating new polygon copy
   */
  copyFrom(polygon) {
    this.points = polygon.points.slice();
    this.closePath = polygon.closePath;
    return this;
  }
  /**
   * Copies this polygon to another one.
   * @example
   * ```ts
   * // Basic copying
   * const source = new Polygon([0, 0, 100, 0, 50, 100]);
   * const target = new Polygon();
   * source.copyTo(target);
   * ```
   * @param polygon - The polygon to copy to
   * @returns Returns given parameter
   * @see {@link Polygon.copyFrom} For copying from another polygon
   * @see {@link Polygon.clone} For creating new polygon copy
   */
  copyTo(polygon) {
    polygon.copyFrom(this);
    return polygon;
  }
  toString() {
    return `[pixi.js/math:PolygoncloseStroke=${this.closePath}points=${this.points.reduce((pointsDesc, currentPoint) => `${pointsDesc}, ${currentPoint}`, "")}]`;
  }
  /**
   * Get the last X coordinate of the polygon.
   * @example
   * ```ts
   * // Basic coordinate access
   * const polygon = new Polygon([0, 0, 100, 200, 300, 400]);
   * console.log(polygon.lastX); // 300
   * ```
   * @readonly
   * @returns The x-coordinate of the last vertex
   * @see {@link Polygon.lastY} For last Y coordinate
   * @see {@link Polygon.points} For raw points array
   */
  get lastX() {
    return this.points[this.points.length - 2];
  }
  /**
   * Get the last Y coordinate of the polygon.
   * @example
   * ```ts
   * // Basic coordinate access
   * const polygon = new Polygon([0, 0, 100, 200, 300, 400]);
   * console.log(polygon.lastY); // 400
   * ```
   * @readonly
   * @returns The y-coordinate of the last vertex
   * @see {@link Polygon.lastX} For last X coordinate
   * @see {@link Polygon.points} For raw points array
   */
  get lastY() {
    return this.points[this.points.length - 1];
  }
  /**
   * Get the last X coordinate of the polygon.
   * @readonly
   * @deprecated since 8.11.0, use {@link Polygon.lastX} instead.
   */
  get x() {
    (0,deprecation/* deprecation */.t6)("8.11.0", "Polygon.lastX is deprecated, please use Polygon.lastX instead.");
    return this.points[this.points.length - 2];
  }
  /**
   * Get the last Y coordinate of the polygon.
   * @readonly
   * @deprecated since 8.11.0, use {@link Polygon.lastY} instead.
   */
  get y() {
    (0,deprecation/* deprecation */.t6)("8.11.0", "Polygon.y is deprecated, please use Polygon.lastY instead.");
    return this.points[this.points.length - 1];
  }
  /**
   * Get the first X coordinate of the polygon.
   * @example
   * ```ts
   * // Basic coordinate access
   * const polygon = new Polygon([0, 0, 100, 200, 300, 400]);
   * console.log(polygon.x); // 0
   * ```
   * @readonly
   * @returns The x-coordinate of the first vertex
   * @see {@link Polygon.startY} For first Y coordinate
   * @see {@link Polygon.points} For raw points array
   */
  get startX() {
    return this.points[0];
  }
  /**
   * Get the first Y coordinate of the polygon.
   * @example
   * ```ts
   * // Basic coordinate access
   * const polygon = new Polygon([0, 0, 100, 200, 300, 400]);
   * console.log(polygon.y); // 0
   * ```
   * @readonly
   * @returns The y-coordinate of the first vertex
   * @see {@link Polygon.startX} For first X coordinate
   * @see {@link Polygon.points} For raw points array
   */
  get startY() {
    return this.points[1];
  }
}


//# sourceMappingURL=Polygon.mjs.map

;// ./node_modules/pixi.js/lib/maths/shapes/RoundedRectangle.mjs


"use strict";
const isCornerWithinStroke = (pX, pY, cornerX, cornerY, radius, strokeWidthInner, strokeWidthOuter) => {
  const dx = pX - cornerX;
  const dy = pY - cornerY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance >= radius - strokeWidthInner && distance <= radius + strokeWidthOuter;
};
class RoundedRectangle {
  /**
   * @param x - The X coordinate of the upper-left corner of the rounded rectangle
   * @param y - The Y coordinate of the upper-left corner of the rounded rectangle
   * @param width - The overall width of this rounded rectangle
   * @param height - The overall height of this rounded rectangle
   * @param radius - Controls the radius of the rounded corners
   */
  constructor(x = 0, y = 0, width = 0, height = 0, radius = 20) {
    /**
     * The type of the object, mainly used to avoid `instanceof` checks
     * @example
     * ```ts
     * // Check shape type
     * const shape = new RoundedRectangle(0, 0, 100, 100, 20);
     * console.log(shape.type); // 'roundedRectangle'
     *
     * // Use in type guards
     * if (shape.type === 'roundedRectangle') {
     *     console.log(shape.radius);
     * }
     * ```
     * @readonly
     * @default 'roundedRectangle'
     * @see {@link SHAPE_PRIMITIVE} For all shape types
     */
    this.type = "roundedRectangle";
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.radius = radius;
  }
  /**
   * Returns the framing rectangle of the rounded rectangle as a Rectangle object
   * @example
   * ```ts
   * // Basic bounds calculation
   * const rect = new RoundedRectangle(100, 100, 200, 150, 20);
   * const bounds = rect.getBounds();
   * // bounds: x=100, y=100, width=200, height=150
   *
   * // Reuse existing rectangle
   * const out = new Rectangle();
   * rect.getBounds(out);
   * ```
   * @remarks
   * - Rectangle matches outer dimensions
   * - Ignores corner radius
   * @param out - Optional rectangle to store the result
   * @returns The framing rectangle
   * @see {@link Rectangle} For rectangle properties
   * @see {@link RoundedRectangle.contains} For checking if a point is inside
   */
  getBounds(out) {
    out || (out = new Rectangle/* Rectangle */.M());
    out.x = this.x;
    out.y = this.y;
    out.width = this.width;
    out.height = this.height;
    return out;
  }
  /**
   * Creates a clone of this Rounded Rectangle.
   * @example
   * ```ts
   * // Basic cloning
   * const original = new RoundedRectangle(100, 100, 200, 150, 20);
   * const copy = original.clone();
   *
   * // Clone and modify
   * const modified = original.clone();
   * modified.radius = 30;
   * modified.width *= 2;
   *
   * // Verify independence
   * console.log(original.radius);  // 20
   * console.log(modified.radius);  // 30
   * ```
   * @returns A copy of the rounded rectangle
   * @see {@link RoundedRectangle.copyFrom} For copying into existing rectangle
   * @see {@link RoundedRectangle.copyTo} For copying to another rectangle
   */
  clone() {
    return new RoundedRectangle(this.x, this.y, this.width, this.height, this.radius);
  }
  /**
   * Copies another rectangle to this one.
   * @example
   * ```ts
   * // Basic copying
   * const source = new RoundedRectangle(100, 100, 200, 150, 20);
   * const target = new RoundedRectangle();
   * target.copyFrom(source);
   *
   * // Chain with other operations
   * const rect = new RoundedRectangle()
   *     .copyFrom(source)
   *     .getBounds(rect);
   * ```
   * @param rectangle - The rectangle to copy from
   * @returns Returns itself
   * @see {@link RoundedRectangle.copyTo} For copying to another rectangle
   * @see {@link RoundedRectangle.clone} For creating new rectangle copy
   */
  copyFrom(rectangle) {
    this.x = rectangle.x;
    this.y = rectangle.y;
    this.width = rectangle.width;
    this.height = rectangle.height;
    return this;
  }
  /**
   * Copies this rectangle to another one.
   * @example
   * ```ts
   * // Basic copying
   * const source = new RoundedRectangle(100, 100, 200, 150, 20);
   * const target = new RoundedRectangle();
   * source.copyTo(target);
   *
   * // Chain with other operations
   * const result = source
   *     .copyTo(new RoundedRectangle())
   *     .getBounds();
   * ```
   * @param rectangle - The rectangle to copy to
   * @returns Returns given parameter
   * @see {@link RoundedRectangle.copyFrom} For copying from another rectangle
   * @see {@link RoundedRectangle.clone} For creating new rectangle copy
   */
  copyTo(rectangle) {
    rectangle.copyFrom(this);
    return rectangle;
  }
  /**
   * Checks whether the x and y coordinates given are contained within this Rounded Rectangle
   * @example
   * ```ts
   * // Basic containment check
   * const rect = new RoundedRectangle(100, 100, 200, 150, 20);
   * const isInside = rect.contains(150, 125); // true
   * // Check corner radius
   * const corner = rect.contains(100, 100); // false if within corner curve
   * ```
   * @remarks
   * - Returns false if width/height is 0 or negative
   * - Handles rounded corners with radius check
   * @param x - The X coordinate of the point to test
   * @param y - The Y coordinate of the point to test
   * @returns Whether the x/y coordinates are within this Rounded Rectangle
   * @see {@link RoundedRectangle.strokeContains} For checking stroke intersection
   * @see {@link RoundedRectangle.getBounds} For getting containing rectangle
   */
  contains(x, y) {
    if (this.width <= 0 || this.height <= 0) {
      return false;
    }
    if (x >= this.x && x <= this.x + this.width) {
      if (y >= this.y && y <= this.y + this.height) {
        const radius = Math.max(0, Math.min(this.radius, Math.min(this.width, this.height) / 2));
        if (y >= this.y + radius && y <= this.y + this.height - radius || x >= this.x + radius && x <= this.x + this.width - radius) {
          return true;
        }
        let dx = x - (this.x + radius);
        let dy = y - (this.y + radius);
        const radius2 = radius * radius;
        if (dx * dx + dy * dy <= radius2) {
          return true;
        }
        dx = x - (this.x + this.width - radius);
        if (dx * dx + dy * dy <= radius2) {
          return true;
        }
        dy = y - (this.y + this.height - radius);
        if (dx * dx + dy * dy <= radius2) {
          return true;
        }
        dx = x - (this.x + radius);
        if (dx * dx + dy * dy <= radius2) {
          return true;
        }
      }
    }
    return false;
  }
  /**
   * Checks whether the x and y coordinates given are contained within this rectangle including the stroke.
   * @example
   * ```ts
   * // Basic stroke check
   * const rect = new RoundedRectangle(100, 100, 200, 150, 20);
   * const isOnStroke = rect.strokeContains(150, 100, 4); // 4px line width
   *
   * // Check with different alignments
   * const innerStroke = rect.strokeContains(150, 100, 4, 1);   // Inside
   * const centerStroke = rect.strokeContains(150, 100, 4, 0.5); // Centered
   * const outerStroke = rect.strokeContains(150, 100, 4, 0);   // Outside
   * ```
   * @param pX - The X coordinate of the point to test
   * @param pY - The Y coordinate of the point to test
   * @param strokeWidth - The width of the line to check
   * @param alignment - The alignment of the stroke (1 = inner, 0.5 = centered, 0 = outer)
   * @returns Whether the x/y coordinates are within this rectangle's stroke
   * @see {@link RoundedRectangle.contains} For checking fill containment
   * @see {@link RoundedRectangle.getBounds} For getting stroke bounds
   */
  strokeContains(pX, pY, strokeWidth, alignment = 0.5) {
    const { x, y, width, height, radius } = this;
    const strokeWidthOuter = strokeWidth * (1 - alignment);
    const strokeWidthInner = strokeWidth - strokeWidthOuter;
    const innerX = x + radius;
    const innerY = y + radius;
    const innerWidth = width - radius * 2;
    const innerHeight = height - radius * 2;
    const rightBound = x + width;
    const bottomBound = y + height;
    if ((pX >= x - strokeWidthOuter && pX <= x + strokeWidthInner || pX >= rightBound - strokeWidthInner && pX <= rightBound + strokeWidthOuter) && pY >= innerY && pY <= innerY + innerHeight) {
      return true;
    }
    if ((pY >= y - strokeWidthOuter && pY <= y + strokeWidthInner || pY >= bottomBound - strokeWidthInner && pY <= bottomBound + strokeWidthOuter) && pX >= innerX && pX <= innerX + innerWidth) {
      return true;
    }
    return (
      // Top-left
      pX < innerX && pY < innerY && isCornerWithinStroke(
        pX,
        pY,
        innerX,
        innerY,
        radius,
        strokeWidthInner,
        strokeWidthOuter
      ) || pX > rightBound - radius && pY < innerY && isCornerWithinStroke(
        pX,
        pY,
        rightBound - radius,
        innerY,
        radius,
        strokeWidthInner,
        strokeWidthOuter
      ) || pX > rightBound - radius && pY > bottomBound - radius && isCornerWithinStroke(
        pX,
        pY,
        rightBound - radius,
        bottomBound - radius,
        radius,
        strokeWidthInner,
        strokeWidthOuter
      ) || pX < innerX && pY > bottomBound - radius && isCornerWithinStroke(
        pX,
        pY,
        innerX,
        bottomBound - radius,
        radius,
        strokeWidthInner,
        strokeWidthOuter
      )
    );
  }
  toString() {
    return `[pixi.js/math:RoundedRectangle x=${this.x} y=${this.y}width=${this.width} height=${this.height} radius=${this.radius}]`;
  }
}


//# sourceMappingURL=RoundedRectangle.mjs.map

// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/graphics/shared/GraphicsContextSystem.mjs + 16 modules
var GraphicsContextSystem = __webpack_require__(5659);
;// ./node_modules/pixi.js/lib/scene/graphics/shared/buildCommands/buildAdaptiveBezier.mjs


"use strict";
const RECURSION_LIMIT = 8;
const FLT_EPSILON = 11920929e-14;
const PATH_DISTANCE_EPSILON = 1;
const curveAngleToleranceEpsilon = 0.01;
const mAngleTolerance = 0;
const mCuspLimit = 0;
function buildAdaptiveBezier(points, sX, sY, cp1x, cp1y, cp2x, cp2y, eX, eY, smoothness) {
  const scale = 1;
  const smoothing = Math.min(
    0.99,
    // a value of 1.0 actually inverts smoothing, so we cap it at 0.99
    Math.max(0, smoothness ?? GraphicsContextSystem/* GraphicsContextSystem */.GH.defaultOptions.bezierSmoothness)
  );
  let distanceTolerance = (PATH_DISTANCE_EPSILON - smoothing) / scale;
  distanceTolerance *= distanceTolerance;
  begin(sX, sY, cp1x, cp1y, cp2x, cp2y, eX, eY, points, distanceTolerance);
  return points;
}
function begin(sX, sY, cp1x, cp1y, cp2x, cp2y, eX, eY, points, distanceTolerance) {
  recursive(sX, sY, cp1x, cp1y, cp2x, cp2y, eX, eY, points, distanceTolerance, 0);
  points.push(eX, eY);
}
function recursive(x1, y1, x2, y2, x3, y3, x4, y4, points, distanceTolerance, level) {
  if (level > RECURSION_LIMIT) {
    return;
  }
  const pi = Math.PI;
  const x12 = (x1 + x2) / 2;
  const y12 = (y1 + y2) / 2;
  const x23 = (x2 + x3) / 2;
  const y23 = (y2 + y3) / 2;
  const x34 = (x3 + x4) / 2;
  const y34 = (y3 + y4) / 2;
  const x123 = (x12 + x23) / 2;
  const y123 = (y12 + y23) / 2;
  const x234 = (x23 + x34) / 2;
  const y234 = (y23 + y34) / 2;
  const x1234 = (x123 + x234) / 2;
  const y1234 = (y123 + y234) / 2;
  if (level > 0) {
    let dx = x4 - x1;
    let dy = y4 - y1;
    const d2 = Math.abs((x2 - x4) * dy - (y2 - y4) * dx);
    const d3 = Math.abs((x3 - x4) * dy - (y3 - y4) * dx);
    let da1;
    let da2;
    if (d2 > FLT_EPSILON && d3 > FLT_EPSILON) {
      if ((d2 + d3) * (d2 + d3) <= distanceTolerance * (dx * dx + dy * dy)) {
        if (mAngleTolerance < curveAngleToleranceEpsilon) {
          points.push(x1234, y1234);
          return;
        }
        const a23 = Math.atan2(y3 - y2, x3 - x2);
        da1 = Math.abs(a23 - Math.atan2(y2 - y1, x2 - x1));
        da2 = Math.abs(Math.atan2(y4 - y3, x4 - x3) - a23);
        if (da1 >= pi)
          da1 = 2 * pi - da1;
        if (da2 >= pi)
          da2 = 2 * pi - da2;
        if (da1 + da2 < mAngleTolerance) {
          points.push(x1234, y1234);
          return;
        }
        if (mCuspLimit !== 0) {
          if (da1 > mCuspLimit) {
            points.push(x2, y2);
            return;
          }
          if (da2 > mCuspLimit) {
            points.push(x3, y3);
            return;
          }
        }
      }
    } else if (d2 > FLT_EPSILON) {
      if (d2 * d2 <= distanceTolerance * (dx * dx + dy * dy)) {
        if (mAngleTolerance < curveAngleToleranceEpsilon) {
          points.push(x1234, y1234);
          return;
        }
        da1 = Math.abs(Math.atan2(y3 - y2, x3 - x2) - Math.atan2(y2 - y1, x2 - x1));
        if (da1 >= pi)
          da1 = 2 * pi - da1;
        if (da1 < mAngleTolerance) {
          points.push(x2, y2);
          points.push(x3, y3);
          return;
        }
        if (mCuspLimit !== 0) {
          if (da1 > mCuspLimit) {
            points.push(x2, y2);
            return;
          }
        }
      }
    } else if (d3 > FLT_EPSILON) {
      if (d3 * d3 <= distanceTolerance * (dx * dx + dy * dy)) {
        if (mAngleTolerance < curveAngleToleranceEpsilon) {
          points.push(x1234, y1234);
          return;
        }
        da1 = Math.abs(Math.atan2(y4 - y3, x4 - x3) - Math.atan2(y3 - y2, x3 - x2));
        if (da1 >= pi)
          da1 = 2 * pi - da1;
        if (da1 < mAngleTolerance) {
          points.push(x2, y2);
          points.push(x3, y3);
          return;
        }
        if (mCuspLimit !== 0) {
          if (da1 > mCuspLimit) {
            points.push(x3, y3);
            return;
          }
        }
      }
    } else {
      dx = x1234 - (x1 + x4) / 2;
      dy = y1234 - (y1 + y4) / 2;
      if (dx * dx + dy * dy <= distanceTolerance) {
        points.push(x1234, y1234);
        return;
      }
    }
  }
  recursive(x1, y1, x12, y12, x123, y123, x1234, y1234, points, distanceTolerance, level + 1);
  recursive(x1234, y1234, x234, y234, x34, y34, x4, y4, points, distanceTolerance, level + 1);
}


//# sourceMappingURL=buildAdaptiveBezier.mjs.map

;// ./node_modules/pixi.js/lib/scene/graphics/shared/buildCommands/buildAdaptiveQuadratic.mjs


"use strict";
const buildAdaptiveQuadratic_RECURSION_LIMIT = 8;
const buildAdaptiveQuadratic_FLT_EPSILON = 11920929e-14;
const buildAdaptiveQuadratic_PATH_DISTANCE_EPSILON = 1;
const buildAdaptiveQuadratic_curveAngleToleranceEpsilon = 0.01;
const buildAdaptiveQuadratic_mAngleTolerance = 0;
function buildAdaptiveQuadratic(points, sX, sY, cp1x, cp1y, eX, eY, smoothness) {
  const scale = 1;
  const smoothing = Math.min(
    0.99,
    // a value of 1.0 actually inverts smoothing, so we cap it at 0.99
    Math.max(0, smoothness ?? GraphicsContextSystem/* GraphicsContextSystem */.GH.defaultOptions.bezierSmoothness)
  );
  let distanceTolerance = (buildAdaptiveQuadratic_PATH_DISTANCE_EPSILON - smoothing) / scale;
  distanceTolerance *= distanceTolerance;
  buildAdaptiveQuadratic_begin(sX, sY, cp1x, cp1y, eX, eY, points, distanceTolerance);
  return points;
}
function buildAdaptiveQuadratic_begin(sX, sY, cp1x, cp1y, eX, eY, points, distanceTolerance) {
  buildAdaptiveQuadratic_recursive(points, sX, sY, cp1x, cp1y, eX, eY, distanceTolerance, 0);
  points.push(eX, eY);
}
function buildAdaptiveQuadratic_recursive(points, x1, y1, x2, y2, x3, y3, distanceTolerance, level) {
  if (level > buildAdaptiveQuadratic_RECURSION_LIMIT) {
    return;
  }
  const pi = Math.PI;
  const x12 = (x1 + x2) / 2;
  const y12 = (y1 + y2) / 2;
  const x23 = (x2 + x3) / 2;
  const y23 = (y2 + y3) / 2;
  const x123 = (x12 + x23) / 2;
  const y123 = (y12 + y23) / 2;
  let dx = x3 - x1;
  let dy = y3 - y1;
  const d = Math.abs((x2 - x3) * dy - (y2 - y3) * dx);
  if (d > buildAdaptiveQuadratic_FLT_EPSILON) {
    if (d * d <= distanceTolerance * (dx * dx + dy * dy)) {
      if (buildAdaptiveQuadratic_mAngleTolerance < buildAdaptiveQuadratic_curveAngleToleranceEpsilon) {
        points.push(x123, y123);
        return;
      }
      let da = Math.abs(Math.atan2(y3 - y2, x3 - x2) - Math.atan2(y2 - y1, x2 - x1));
      if (da >= pi)
        da = 2 * pi - da;
      if (da < buildAdaptiveQuadratic_mAngleTolerance) {
        points.push(x123, y123);
        return;
      }
    }
  } else {
    dx = x123 - (x1 + x3) / 2;
    dy = y123 - (y1 + y3) / 2;
    if (dx * dx + dy * dy <= distanceTolerance) {
      points.push(x123, y123);
      return;
    }
  }
  buildAdaptiveQuadratic_recursive(points, x1, y1, x12, y12, x123, y123, distanceTolerance, level + 1);
  buildAdaptiveQuadratic_recursive(points, x123, y123, x23, y23, x3, y3, distanceTolerance, level + 1);
}


//# sourceMappingURL=buildAdaptiveQuadratic.mjs.map

;// ./node_modules/pixi.js/lib/scene/graphics/shared/buildCommands/buildArc.mjs

function buildArc(points, x, y, radius, start, end, clockwise, steps) {
  let dist = Math.abs(start - end);
  if (!clockwise && start > end) {
    dist = 2 * Math.PI - dist;
  } else if (clockwise && end > start) {
    dist = 2 * Math.PI - dist;
  }
  steps || (steps = Math.max(6, Math.floor(6 * Math.pow(radius, 1 / 3) * (dist / Math.PI))));
  steps = Math.max(steps, 3);
  let f = dist / steps;
  let t = start;
  f *= clockwise ? -1 : 1;
  for (let i = 0; i < steps + 1; i++) {
    const cs = Math.cos(t);
    const sn = Math.sin(t);
    const nx = x + cs * radius;
    const ny = y + sn * radius;
    points.push(nx, ny);
    t += f;
  }
}


//# sourceMappingURL=buildArc.mjs.map

;// ./node_modules/pixi.js/lib/scene/graphics/shared/buildCommands/buildArcTo.mjs


"use strict";
function buildArcTo(points, x1, y1, x2, y2, radius) {
  const fromX = points[points.length - 2];
  const fromY = points[points.length - 1];
  const a1 = fromY - y1;
  const b1 = fromX - x1;
  const a2 = y2 - y1;
  const b2 = x2 - x1;
  const mm = Math.abs(a1 * b2 - b1 * a2);
  if (mm < 1e-8 || radius === 0) {
    if (points[points.length - 2] !== x1 || points[points.length - 1] !== y1) {
      points.push(x1, y1);
    }
    return;
  }
  const dd = a1 * a1 + b1 * b1;
  const cc = a2 * a2 + b2 * b2;
  const tt = a1 * a2 + b1 * b2;
  const k1 = radius * Math.sqrt(dd) / mm;
  const k2 = radius * Math.sqrt(cc) / mm;
  const j1 = k1 * tt / dd;
  const j2 = k2 * tt / cc;
  const cx = k1 * b2 + k2 * b1;
  const cy = k1 * a2 + k2 * a1;
  const px = b1 * (k2 + j1);
  const py = a1 * (k2 + j1);
  const qx = b2 * (k1 + j2);
  const qy = a2 * (k1 + j2);
  const startAngle = Math.atan2(py - cy, px - cx);
  const endAngle = Math.atan2(qy - cy, qx - cx);
  buildArc(
    points,
    cx + x1,
    cy + y1,
    radius,
    startAngle,
    endAngle,
    b1 * a2 > b2 * a1
  );
}


//# sourceMappingURL=buildArcTo.mjs.map

;// ./node_modules/pixi.js/lib/scene/graphics/shared/buildCommands/buildArcToSvg.mjs


"use strict";
const TAU = Math.PI * 2;
const out = {
  centerX: 0,
  centerY: 0,
  ang1: 0,
  ang2: 0
};
const mapToEllipse = ({ x, y }, rx, ry, cosPhi, sinPhi, centerX, centerY, out2) => {
  x *= rx;
  y *= ry;
  const xp = cosPhi * x - sinPhi * y;
  const yp = sinPhi * x + cosPhi * y;
  out2.x = xp + centerX;
  out2.y = yp + centerY;
  return out2;
};
function approxUnitArc(ang1, ang2) {
  const a1 = ang2 === -1.5707963267948966 ? -0.551915024494 : 4 / 3 * Math.tan(ang2 / 4);
  const a = ang2 === 1.5707963267948966 ? 0.551915024494 : a1;
  const x1 = Math.cos(ang1);
  const y1 = Math.sin(ang1);
  const x2 = Math.cos(ang1 + ang2);
  const y2 = Math.sin(ang1 + ang2);
  return [
    {
      x: x1 - y1 * a,
      y: y1 + x1 * a
    },
    {
      x: x2 + y2 * a,
      y: y2 - x2 * a
    },
    {
      x: x2,
      y: y2
    }
  ];
}
const vectorAngle = (ux, uy, vx, vy) => {
  const sign = ux * vy - uy * vx < 0 ? -1 : 1;
  let dot = ux * vx + uy * vy;
  if (dot > 1) {
    dot = 1;
  }
  if (dot < -1) {
    dot = -1;
  }
  return sign * Math.acos(dot);
};
const getArcCenter = (px, py, cx, cy, rx, ry, largeArcFlag, sweepFlag, sinPhi, cosPhi, pxp, pyp, out2) => {
  const rxSq = Math.pow(rx, 2);
  const rySq = Math.pow(ry, 2);
  const pxpSq = Math.pow(pxp, 2);
  const pypSq = Math.pow(pyp, 2);
  let radicant = rxSq * rySq - rxSq * pypSq - rySq * pxpSq;
  if (radicant < 0) {
    radicant = 0;
  }
  radicant /= rxSq * pypSq + rySq * pxpSq;
  radicant = Math.sqrt(radicant) * (largeArcFlag === sweepFlag ? -1 : 1);
  const centerXp = radicant * rx / ry * pyp;
  const centerYp = radicant * -ry / rx * pxp;
  const centerX = cosPhi * centerXp - sinPhi * centerYp + (px + cx) / 2;
  const centerY = sinPhi * centerXp + cosPhi * centerYp + (py + cy) / 2;
  const vx1 = (pxp - centerXp) / rx;
  const vy1 = (pyp - centerYp) / ry;
  const vx2 = (-pxp - centerXp) / rx;
  const vy2 = (-pyp - centerYp) / ry;
  const ang1 = vectorAngle(1, 0, vx1, vy1);
  let ang2 = vectorAngle(vx1, vy1, vx2, vy2);
  if (sweepFlag === 0 && ang2 > 0) {
    ang2 -= TAU;
  }
  if (sweepFlag === 1 && ang2 < 0) {
    ang2 += TAU;
  }
  out2.centerX = centerX;
  out2.centerY = centerY;
  out2.ang1 = ang1;
  out2.ang2 = ang2;
};
function buildArcToSvg(points, px, py, cx, cy, rx, ry, xAxisRotation = 0, largeArcFlag = 0, sweepFlag = 0) {
  if (rx === 0 || ry === 0) {
    return;
  }
  const sinPhi = Math.sin(xAxisRotation * TAU / 360);
  const cosPhi = Math.cos(xAxisRotation * TAU / 360);
  const pxp = cosPhi * (px - cx) / 2 + sinPhi * (py - cy) / 2;
  const pyp = -sinPhi * (px - cx) / 2 + cosPhi * (py - cy) / 2;
  if (pxp === 0 && pyp === 0) {
    return;
  }
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const lambda = Math.pow(pxp, 2) / Math.pow(rx, 2) + Math.pow(pyp, 2) / Math.pow(ry, 2);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  getArcCenter(
    px,
    py,
    cx,
    cy,
    rx,
    ry,
    largeArcFlag,
    sweepFlag,
    sinPhi,
    cosPhi,
    pxp,
    pyp,
    out
  );
  let { ang1, ang2 } = out;
  const { centerX, centerY } = out;
  let ratio = Math.abs(ang2) / (TAU / 4);
  if (Math.abs(1 - ratio) < 1e-7) {
    ratio = 1;
  }
  const segments = Math.max(Math.ceil(ratio), 1);
  ang2 /= segments;
  let lastX = points[points.length - 2];
  let lastY = points[points.length - 1];
  const outCurvePoint = { x: 0, y: 0 };
  for (let i = 0; i < segments; i++) {
    const curve = approxUnitArc(ang1, ang2);
    const { x: x1, y: y1 } = mapToEllipse(curve[0], rx, ry, cosPhi, sinPhi, centerX, centerY, outCurvePoint);
    const { x: x2, y: y2 } = mapToEllipse(curve[1], rx, ry, cosPhi, sinPhi, centerX, centerY, outCurvePoint);
    const { x, y } = mapToEllipse(curve[2], rx, ry, cosPhi, sinPhi, centerX, centerY, outCurvePoint);
    buildAdaptiveBezier(
      points,
      lastX,
      lastY,
      x1,
      y1,
      x2,
      y2,
      x,
      y
    );
    lastX = x;
    lastY = y;
    ang1 += ang2;
  }
}


//# sourceMappingURL=buildArcToSvg.mjs.map

;// ./node_modules/pixi.js/lib/scene/graphics/shared/path/roundShape.mjs

function roundedShapeArc(g, points, radius) {
  const vecFrom = (p, pp) => {
    const x = pp.x - p.x;
    const y = pp.y - p.y;
    const len = Math.sqrt(x * x + y * y);
    const nx = x / len;
    const ny = y / len;
    return { len, nx, ny };
  };
  const sharpCorner = (i, p) => {
    if (i === 0) {
      g.moveTo(p.x, p.y);
    } else {
      g.lineTo(p.x, p.y);
    }
  };
  let p1 = points[points.length - 1];
  for (let i = 0; i < points.length; i++) {
    const p2 = points[i % points.length];
    const pRadius = p2.radius ?? radius;
    if (pRadius <= 0) {
      sharpCorner(i, p2);
      p1 = p2;
      continue;
    }
    const p3 = points[(i + 1) % points.length];
    const v1 = vecFrom(p2, p1);
    const v2 = vecFrom(p2, p3);
    if (v1.len < 1e-4 || v2.len < 1e-4) {
      sharpCorner(i, p2);
      p1 = p2;
      continue;
    }
    let angle = Math.asin(v1.nx * v2.ny - v1.ny * v2.nx);
    let radDirection = 1;
    let drawDirection = false;
    if (v1.nx * v2.nx - v1.ny * -v2.ny < 0) {
      if (angle < 0) {
        angle = Math.PI + angle;
      } else {
        angle = Math.PI - angle;
        radDirection = -1;
        drawDirection = true;
      }
    } else if (angle > 0) {
      radDirection = -1;
      drawDirection = true;
    }
    const halfAngle = angle / 2;
    let cRadius;
    let lenOut = Math.abs(
      Math.cos(halfAngle) * pRadius / Math.sin(halfAngle)
    );
    if (lenOut > Math.min(v1.len / 2, v2.len / 2)) {
      lenOut = Math.min(v1.len / 2, v2.len / 2);
      cRadius = Math.abs(lenOut * Math.sin(halfAngle) / Math.cos(halfAngle));
    } else {
      cRadius = pRadius;
    }
    const cX = p2.x + v2.nx * lenOut + -v2.ny * cRadius * radDirection;
    const cY = p2.y + v2.ny * lenOut + v2.nx * cRadius * radDirection;
    const startAngle = Math.atan2(v1.ny, v1.nx) + Math.PI / 2 * radDirection;
    const endAngle = Math.atan2(v2.ny, v2.nx) - Math.PI / 2 * radDirection;
    if (i === 0) {
      g.moveTo(
        cX + Math.cos(startAngle) * cRadius,
        cY + Math.sin(startAngle) * cRadius
      );
    }
    g.arc(cX, cY, cRadius, startAngle, endAngle, drawDirection);
    p1 = p2;
  }
}
function roundedShapeQuadraticCurve(g, points, radius, smoothness) {
  const distance = (p1, p2) => Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
  const pointLerp = (p1, p2, t) => ({
    x: p1.x + (p2.x - p1.x) * t,
    y: p1.y + (p2.y - p1.y) * t
  });
  const numPoints = points.length;
  for (let i = 0; i < numPoints; i++) {
    const thisPoint = points[(i + 1) % numPoints];
    const pRadius = thisPoint.radius ?? radius;
    if (pRadius <= 0) {
      if (i === 0) {
        g.moveTo(thisPoint.x, thisPoint.y);
      } else {
        g.lineTo(thisPoint.x, thisPoint.y);
      }
      continue;
    }
    const lastPoint = points[i];
    const nextPoint = points[(i + 2) % numPoints];
    const lastEdgeLength = distance(lastPoint, thisPoint);
    let start;
    if (lastEdgeLength < 1e-4) {
      start = thisPoint;
    } else {
      const lastOffsetDistance = Math.min(lastEdgeLength / 2, pRadius);
      start = pointLerp(
        thisPoint,
        lastPoint,
        lastOffsetDistance / lastEdgeLength
      );
    }
    const nextEdgeLength = distance(nextPoint, thisPoint);
    let end;
    if (nextEdgeLength < 1e-4) {
      end = thisPoint;
    } else {
      const nextOffsetDistance = Math.min(nextEdgeLength / 2, pRadius);
      end = pointLerp(
        thisPoint,
        nextPoint,
        nextOffsetDistance / nextEdgeLength
      );
    }
    if (i === 0) {
      g.moveTo(start.x, start.y);
    } else {
      g.lineTo(start.x, start.y);
    }
    g.quadraticCurveTo(thisPoint.x, thisPoint.y, end.x, end.y, smoothness);
  }
}


//# sourceMappingURL=roundShape.mjs.map

;// ./node_modules/pixi.js/lib/scene/graphics/shared/path/ShapePath.mjs













"use strict";
const tempRectangle = new Rectangle/* Rectangle */.M();
class ShapePath {
  constructor(graphicsPath2D) {
    /** The list of shape primitives that make up the path. */
    this.shapePrimitives = [];
    this._currentPoly = null;
    this._bounds = new Bounds/* Bounds */.c();
    this._graphicsPath2D = graphicsPath2D;
    this.signed = graphicsPath2D.checkForHoles;
  }
  /**
   * Sets the starting point for a new sub-path. Any subsequent drawing commands are considered part of this path.
   * @param x - The x-coordinate for the starting point.
   * @param y - The y-coordinate for the starting point.
   * @returns The instance of the current object for chaining.
   */
  moveTo(x, y) {
    this.startPoly(x, y);
    return this;
  }
  /**
   * Connects the current point to a new point with a straight line. This method updates the current path.
   * @param x - The x-coordinate of the new point to connect to.
   * @param y - The y-coordinate of the new point to connect to.
   * @returns The instance of the current object for chaining.
   */
  lineTo(x, y) {
    this._ensurePoly();
    const points = this._currentPoly.points;
    const fromX = points[points.length - 2];
    const fromY = points[points.length - 1];
    if (fromX !== x || fromY !== y) {
      points.push(x, y);
    }
    return this;
  }
  /**
   * Adds an arc to the path. The arc is centered at (x, y)
   *  position with radius `radius` starting at `startAngle` and ending at `endAngle`.
   * @param x - The x-coordinate of the arc's center.
   * @param y - The y-coordinate of the arc's center.
   * @param radius - The radius of the arc.
   * @param startAngle - The starting angle of the arc, in radians.
   * @param endAngle - The ending angle of the arc, in radians.
   * @param counterclockwise - Specifies whether the arc should be drawn in the anticlockwise direction. False by default.
   * @returns The instance of the current object for chaining.
   */
  arc(x, y, radius, startAngle, endAngle, counterclockwise) {
    this._ensurePoly(false);
    const points = this._currentPoly.points;
    buildArc(points, x, y, radius, startAngle, endAngle, counterclockwise);
    return this;
  }
  /**
   * Adds an arc to the path with the arc tangent to the line joining two specified points.
   * The arc radius is specified by `radius`.
   * @param x1 - The x-coordinate of the first point.
   * @param y1 - The y-coordinate of the first point.
   * @param x2 - The x-coordinate of the second point.
   * @param y2 - The y-coordinate of the second point.
   * @param radius - The radius of the arc.
   * @returns The instance of the current object for chaining.
   */
  arcTo(x1, y1, x2, y2, radius) {
    this._ensurePoly();
    const points = this._currentPoly.points;
    buildArcTo(points, x1, y1, x2, y2, radius);
    return this;
  }
  /**
   * Adds an SVG-style arc to the path, allowing for elliptical arcs based on the SVG spec.
   * @param rx - The x-radius of the ellipse.
   * @param ry - The y-radius of the ellipse.
   * @param xAxisRotation - The rotation of the ellipse's x-axis relative
   * to the x-axis of the coordinate system, in degrees.
   * @param largeArcFlag - Determines if the arc should be greater than or less than 180 degrees.
   * @param sweepFlag - Determines if the arc should be swept in a positive angle direction.
   * @param x - The x-coordinate of the arc's end point.
   * @param y - The y-coordinate of the arc's end point.
   * @returns The instance of the current object for chaining.
   */
  arcToSvg(rx, ry, xAxisRotation, largeArcFlag, sweepFlag, x, y) {
    const points = this._currentPoly.points;
    buildArcToSvg(
      points,
      this._currentPoly.lastX,
      this._currentPoly.lastY,
      x,
      y,
      rx,
      ry,
      xAxisRotation,
      largeArcFlag,
      sweepFlag
    );
    return this;
  }
  /**
   * Adds a cubic Bezier curve to the path.
   * It requires three points: the first two are control points and the third one is the end point.
   * The starting point is the last point in the current path.
   * @param cp1x - The x-coordinate of the first control point.
   * @param cp1y - The y-coordinate of the first control point.
   * @param cp2x - The x-coordinate of the second control point.
   * @param cp2y - The y-coordinate of the second control point.
   * @param x - The x-coordinate of the end point.
   * @param y - The y-coordinate of the end point.
   * @param smoothness - Optional parameter to adjust the smoothness of the curve.
   * @returns The instance of the current object for chaining.
   */
  bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y, smoothness) {
    this._ensurePoly();
    const currentPoly = this._currentPoly;
    buildAdaptiveBezier(
      this._currentPoly.points,
      currentPoly.lastX,
      currentPoly.lastY,
      cp1x,
      cp1y,
      cp2x,
      cp2y,
      x,
      y,
      smoothness
    );
    return this;
  }
  /**
   * Adds a quadratic curve to the path. It requires two points: the control point and the end point.
   * The starting point is the last point in the current path.
   * @param cp1x - The x-coordinate of the control point.
   * @param cp1y - The y-coordinate of the control point.
   * @param x - The x-coordinate of the end point.
   * @param y - The y-coordinate of the end point.
   * @param smoothing - Optional parameter to adjust the smoothness of the curve.
   * @returns The instance of the current object for chaining.
   */
  quadraticCurveTo(cp1x, cp1y, x, y, smoothing) {
    this._ensurePoly();
    const currentPoly = this._currentPoly;
    buildAdaptiveQuadratic(
      this._currentPoly.points,
      currentPoly.lastX,
      currentPoly.lastY,
      cp1x,
      cp1y,
      x,
      y,
      smoothing
    );
    return this;
  }
  /**
   * Closes the current path by drawing a straight line back to the start.
   * If the shape is already closed or there are no points in the path, this method does nothing.
   * @returns The instance of the current object for chaining.
   */
  closePath() {
    this.endPoly(true);
    return this;
  }
  /**
   * Adds another path to the current path. This method allows for the combination of multiple paths into one.
   * @param path - The `GraphicsPath` object representing the path to add.
   * @param transform - An optional `Matrix` object to apply a transformation to the path before adding it.
   * @returns The instance of the current object for chaining.
   */
  addPath(path, transform) {
    this.endPoly();
    if (transform && !transform.isIdentity()) {
      path = path.clone(true);
      path.transform(transform);
    }
    const shapePrimitives = this.shapePrimitives;
    const start = shapePrimitives.length;
    for (let i = 0; i < path.instructions.length; i++) {
      const instruction = path.instructions[i];
      this[instruction.action](...instruction.data);
    }
    if (path.checkForHoles && shapePrimitives.length - start > 1) {
      let mainShape = null;
      for (let i = start; i < shapePrimitives.length; i++) {
        const shapePrimitive = shapePrimitives[i];
        if (shapePrimitive.shape.type === "polygon") {
          const polygon = shapePrimitive.shape;
          const mainPolygon = mainShape?.shape;
          if (mainPolygon && mainPolygon.containsPolygon(polygon)) {
            mainShape.holes || (mainShape.holes = []);
            mainShape.holes.push(shapePrimitive);
            shapePrimitives.copyWithin(i, i + 1);
            shapePrimitives.length--;
            i--;
          } else {
            mainShape = shapePrimitive;
          }
        }
      }
    }
    return this;
  }
  /**
   * Finalizes the drawing of the current path. Optionally, it can close the path.
   * @param closePath - A boolean indicating whether to close the path after finishing. False by default.
   */
  finish(closePath = false) {
    this.endPoly(closePath);
  }
  /**
   * Draws a rectangle shape. This method adds a new rectangle path to the current drawing.
   * @param x - The x-coordinate of the top-left corner of the rectangle.
   * @param y - The y-coordinate of the top-left corner of the rectangle.
   * @param w - The width of the rectangle.
   * @param h - The height of the rectangle.
   * @param transform - An optional `Matrix` object to apply a transformation to the rectangle.
   * @returns The instance of the current object for chaining.
   */
  rect(x, y, w, h, transform) {
    this.drawShape(new Rectangle/* Rectangle */.M(x, y, w, h), transform);
    return this;
  }
  /**
   * Draws a circle shape. This method adds a new circle path to the current drawing.
   * @param x - The x-coordinate of the center of the circle.
   * @param y - The y-coordinate of the center of the circle.
   * @param radius - The radius of the circle.
   * @param transform - An optional `Matrix` object to apply a transformation to the circle.
   * @returns The instance of the current object for chaining.
   */
  circle(x, y, radius, transform) {
    this.drawShape(new Circle(x, y, radius), transform);
    return this;
  }
  /**
   * Draws a polygon shape. This method allows for the creation of complex polygons by specifying a sequence of points.
   * @param points - An array of numbers, or or an array of PointData objects eg [{x,y}, {x,y}, {x,y}]
   * representing the x and y coordinates of the polygon's vertices, in sequence.
   * @param close - A boolean indicating whether to close the polygon path. True by default.
   * @param transform - An optional `Matrix` object to apply a transformation to the polygon.
   * @returns The instance of the current object for chaining.
   */
  poly(points, close, transform) {
    const polygon = new Polygon(points);
    polygon.closePath = close;
    this.drawShape(polygon, transform);
    return this;
  }
  /**
   * Draws a regular polygon with a specified number of sides. All sides and angles are equal.
   * @param x - The x-coordinate of the center of the polygon.
   * @param y - The y-coordinate of the center of the polygon.
   * @param radius - The radius of the circumscribed circle of the polygon.
   * @param sides - The number of sides of the polygon. Must be 3 or more.
   * @param rotation - The rotation angle of the polygon, in radians. Zero by default.
   * @param transform - An optional `Matrix` object to apply a transformation to the polygon.
   * @returns The instance of the current object for chaining.
   */
  regularPoly(x, y, radius, sides, rotation = 0, transform) {
    sides = Math.max(sides | 0, 3);
    const startAngle = -1 * Math.PI / 2 + rotation;
    const delta = Math.PI * 2 / sides;
    const polygon = [];
    for (let i = 0; i < sides; i++) {
      const angle = startAngle - i * delta;
      polygon.push(
        x + radius * Math.cos(angle),
        y + radius * Math.sin(angle)
      );
    }
    this.poly(polygon, true, transform);
    return this;
  }
  /**
   * Draws a polygon with rounded corners.
   * Similar to `regularPoly` but with the ability to round the corners of the polygon.
   * @param x - The x-coordinate of the center of the polygon.
   * @param y - The y-coordinate of the center of the polygon.
   * @param radius - The radius of the circumscribed circle of the polygon.
   * @param sides - The number of sides of the polygon. Must be 3 or more.
   * @param corner - The radius of the rounding of the corners.
   * @param rotation - The rotation angle of the polygon, in radians. Zero by default.
   * @param smoothness - Optional parameter to adjust the smoothness of the rounding.
   * @returns The instance of the current object for chaining.
   */
  roundPoly(x, y, radius, sides, corner, rotation = 0, smoothness) {
    sides = Math.max(sides | 0, 3);
    if (corner <= 0) {
      return this.regularPoly(x, y, radius, sides, rotation);
    }
    const sideLength = radius * Math.sin(Math.PI / sides) - 1e-3;
    corner = Math.min(corner, sideLength);
    const startAngle = -1 * Math.PI / 2 + rotation;
    const delta = Math.PI * 2 / sides;
    const internalAngle = (sides - 2) * Math.PI / sides / 2;
    for (let i = 0; i < sides; i++) {
      const angle = i * delta + startAngle;
      const x0 = x + radius * Math.cos(angle);
      const y0 = y + radius * Math.sin(angle);
      const a1 = angle + Math.PI + internalAngle;
      const a2 = angle - Math.PI - internalAngle;
      const x1 = x0 + corner * Math.cos(a1);
      const y1 = y0 + corner * Math.sin(a1);
      const x3 = x0 + corner * Math.cos(a2);
      const y3 = y0 + corner * Math.sin(a2);
      if (i === 0) {
        this.moveTo(x1, y1);
      } else {
        this.lineTo(x1, y1);
      }
      this.quadraticCurveTo(x0, y0, x3, y3, smoothness);
    }
    return this.closePath();
  }
  /**
   * Draws a shape with rounded corners. This function supports custom radius for each corner of the shape.
   * Optionally, corners can be rounded using a quadratic curve instead of an arc, providing a different aesthetic.
   * @param points - An array of `RoundedPoint` representing the corners of the shape to draw.
   * A minimum of 3 points is required.
   * @param radius - The default radius for the corners.
   * This radius is applied to all corners unless overridden in `points`.
   * @param useQuadratic - If set to true, rounded corners are drawn using a quadraticCurve
   *  method instead of an arc method. Defaults to false.
   * @param smoothness - Specifies the smoothness of the curve when `useQuadratic` is true.
   * Higher values make the curve smoother.
   * @returns The instance of the current object for chaining.
   */
  roundShape(points, radius, useQuadratic = false, smoothness) {
    if (points.length < 3) {
      return this;
    }
    if (useQuadratic) {
      roundedShapeQuadraticCurve(this, points, radius, smoothness);
    } else {
      roundedShapeArc(this, points, radius);
    }
    return this.closePath();
  }
  /**
   * Draw Rectangle with fillet corners. This is much like rounded rectangle
   * however it support negative numbers as well for the corner radius.
   * @param x - Upper left corner of rect
   * @param y - Upper right corner of rect
   * @param width - Width of rect
   * @param height - Height of rect
   * @param fillet - accept negative or positive values
   */
  filletRect(x, y, width, height, fillet) {
    if (fillet === 0) {
      return this.rect(x, y, width, height);
    }
    const maxFillet = Math.min(width, height) / 2;
    const inset = Math.min(maxFillet, Math.max(-maxFillet, fillet));
    const right = x + width;
    const bottom = y + height;
    const dir = inset < 0 ? -inset : 0;
    const size = Math.abs(inset);
    return this.moveTo(x, y + size).arcTo(x + dir, y + dir, x + size, y, size).lineTo(right - size, y).arcTo(right - dir, y + dir, right, y + size, size).lineTo(right, bottom - size).arcTo(right - dir, bottom - dir, x + width - size, bottom, size).lineTo(x + size, bottom).arcTo(x + dir, bottom - dir, x, bottom - size, size).closePath();
  }
  /**
   * Draw Rectangle with chamfer corners. These are angled corners.
   * @param x - Upper left corner of rect
   * @param y - Upper right corner of rect
   * @param width - Width of rect
   * @param height - Height of rect
   * @param chamfer - non-zero real number, size of corner cutout
   * @param transform
   */
  chamferRect(x, y, width, height, chamfer, transform) {
    if (chamfer <= 0) {
      return this.rect(x, y, width, height);
    }
    const inset = Math.min(chamfer, Math.min(width, height) / 2);
    const right = x + width;
    const bottom = y + height;
    const points = [
      x + inset,
      y,
      right - inset,
      y,
      right,
      y + inset,
      right,
      bottom - inset,
      right - inset,
      bottom,
      x + inset,
      bottom,
      x,
      bottom - inset,
      x,
      y + inset
    ];
    for (let i = points.length - 1; i >= 2; i -= 2) {
      if (points[i] === points[i - 2] && points[i - 1] === points[i - 3]) {
        points.splice(i - 1, 2);
      }
    }
    return this.poly(points, true, transform);
  }
  /**
   * Draws an ellipse at the specified location and with the given x and y radii.
   * An optional transformation can be applied, allowing for rotation, scaling, and translation.
   * @param x - The x-coordinate of the center of the ellipse.
   * @param y - The y-coordinate of the center of the ellipse.
   * @param radiusX - The horizontal radius of the ellipse.
   * @param radiusY - The vertical radius of the ellipse.
   * @param transform - An optional `Matrix` object to apply a transformation to the ellipse. This can include rotations.
   * @returns The instance of the current object for chaining.
   */
  ellipse(x, y, radiusX, radiusY, transform) {
    this.drawShape(new Ellipse(x, y, radiusX, radiusY), transform);
    return this;
  }
  /**
   * Draws a rectangle with rounded corners.
   * The corner radius can be specified to determine how rounded the corners should be.
   * An optional transformation can be applied, which allows for rotation, scaling, and translation of the rectangle.
   * @param x - The x-coordinate of the top-left corner of the rectangle.
   * @param y - The y-coordinate of the top-left corner of the rectangle.
   * @param w - The width of the rectangle.
   * @param h - The height of the rectangle.
   * @param radius - The radius of the rectangle's corners. If not specified, corners will be sharp.
   * @param transform - An optional `Matrix` object to apply a transformation to the rectangle.
   * @returns The instance of the current object for chaining.
   */
  roundRect(x, y, w, h, radius, transform) {
    this.drawShape(new RoundedRectangle(x, y, w, h, radius), transform);
    return this;
  }
  /**
   * Draws a given shape on the canvas.
   * This is a generic method that can draw any type of shape specified by the `ShapePrimitive` parameter.
   * An optional transformation matrix can be applied to the shape, allowing for complex transformations.
   * @param shape - The shape to draw, defined as a `ShapePrimitive` object.
   * @param matrix - An optional `Matrix` for transforming the shape. This can include rotations,
   * scaling, and translations.
   * @returns The instance of the current object for chaining.
   */
  drawShape(shape, matrix) {
    this.endPoly();
    this.shapePrimitives.push({ shape, transform: matrix });
    return this;
  }
  /**
   * Starts a new polygon path from the specified starting point.
   * This method initializes a new polygon or ends the current one if it exists.
   * @param x - The x-coordinate of the starting point of the new polygon.
   * @param y - The y-coordinate of the starting point of the new polygon.
   * @returns The instance of the current object for chaining.
   */
  startPoly(x, y) {
    let currentPoly = this._currentPoly;
    if (currentPoly) {
      this.endPoly();
    }
    currentPoly = new Polygon();
    currentPoly.points.push(x, y);
    this._currentPoly = currentPoly;
    return this;
  }
  /**
   * Ends the current polygon path. If `closePath` is set to true,
   * the path is closed by connecting the last point to the first one.
   * This method finalizes the current polygon and prepares it for drawing or adding to the shape primitives.
   * @param closePath - A boolean indicating whether to close the polygon by connecting the last point
   *  back to the starting point. False by default.
   * @returns The instance of the current object for chaining.
   */
  endPoly(closePath = false) {
    const shape = this._currentPoly;
    if (shape && shape.points.length > 2) {
      shape.closePath = closePath;
      this.shapePrimitives.push({ shape });
    }
    this._currentPoly = null;
    return this;
  }
  _ensurePoly(start = true) {
    if (this._currentPoly)
      return;
    this._currentPoly = new Polygon();
    if (start) {
      const lastShape = this.shapePrimitives[this.shapePrimitives.length - 1];
      if (lastShape) {
        let lx = lastShape.shape.x;
        let ly = lastShape.shape.y;
        if (lastShape.transform && !lastShape.transform.isIdentity()) {
          const t = lastShape.transform;
          const tempX = lx;
          lx = t.a * lx + t.c * ly + t.tx;
          ly = t.b * tempX + t.d * ly + t.ty;
        }
        this._currentPoly.points.push(lx, ly);
      } else {
        this._currentPoly.points.push(0, 0);
      }
    }
  }
  /** Builds the path. */
  buildPath() {
    const path = this._graphicsPath2D;
    this.shapePrimitives.length = 0;
    this._currentPoly = null;
    for (let i = 0; i < path.instructions.length; i++) {
      const instruction = path.instructions[i];
      this[instruction.action](...instruction.data);
    }
    this.finish();
  }
  /** Gets the bounds of the path. */
  get bounds() {
    const bounds = this._bounds;
    bounds.clear();
    const shapePrimitives = this.shapePrimitives;
    for (let i = 0; i < shapePrimitives.length; i++) {
      const shapePrimitive = shapePrimitives[i];
      const boundsRect = shapePrimitive.shape.getBounds(tempRectangle);
      if (shapePrimitive.transform) {
        bounds.addRect(boundsRect, shapePrimitive.transform);
      } else {
        bounds.addRect(boundsRect);
      }
    }
    return bounds;
  }
}


//# sourceMappingURL=ShapePath.mjs.map

;// ./node_modules/pixi.js/lib/scene/graphics/shared/path/GraphicsPath.mjs






"use strict";
class GraphicsPath {
  /**
   * Creates a `GraphicsPath` instance optionally from an SVG path string or an array of `PathInstruction`.
   * @param instructions - An SVG path string or an array of `PathInstruction` objects.
   * @param signed
   */
  constructor(instructions, signed = false) {
    this.instructions = [];
    /** unique id for this graphics path */
    this.uid = (0,uid/* uid */.L)("graphicsPath");
    this._dirty = true;
    this.checkForHoles = signed;
    if (typeof instructions === "string") {
      parseSVGPath(instructions, this);
    } else {
      this.instructions = instructions?.slice() ?? [];
    }
  }
  /**
   * Provides access to the internal shape path, ensuring it is up-to-date with the current instructions.
   * @returns The `ShapePath` instance associated with this `GraphicsPath`.
   */
  get shapePath() {
    if (!this._shapePath) {
      this._shapePath = new ShapePath(this);
    }
    if (this._dirty) {
      this._dirty = false;
      this._shapePath.buildPath();
    }
    return this._shapePath;
  }
  /**
   * Adds another `GraphicsPath` to this path, optionally applying a transformation.
   * @param path - The `GraphicsPath` to add.
   * @param transform - An optional transformation to apply to the added path.
   * @returns The instance of the current object for chaining.
   */
  addPath(path, transform) {
    path = path.clone();
    this.instructions.push({ action: "addPath", data: [path, transform] });
    this._dirty = true;
    return this;
  }
  arc(...args) {
    this.instructions.push({ action: "arc", data: args });
    this._dirty = true;
    return this;
  }
  arcTo(...args) {
    this.instructions.push({ action: "arcTo", data: args });
    this._dirty = true;
    return this;
  }
  arcToSvg(...args) {
    this.instructions.push({ action: "arcToSvg", data: args });
    this._dirty = true;
    return this;
  }
  bezierCurveTo(...args) {
    this.instructions.push({ action: "bezierCurveTo", data: args });
    this._dirty = true;
    return this;
  }
  /**
   * Adds a cubic Bezier curve to the path.
   * It requires two points: the second control point and the end point. The first control point is assumed to be
   * The starting point is the last point in the current path.
   * @param cp2x - The x-coordinate of the second control point.
   * @param cp2y - The y-coordinate of the second control point.
   * @param x - The x-coordinate of the end point.
   * @param y - The y-coordinate of the end point.
   * @param smoothness - Optional parameter to adjust the smoothness of the curve.
   * @returns The instance of the current object for chaining.
   */
  bezierCurveToShort(cp2x, cp2y, x, y, smoothness) {
    const last = this.instructions[this.instructions.length - 1];
    const lastPoint = this.getLastPoint(Point/* Point */.b.shared);
    let cp1x = 0;
    let cp1y = 0;
    if (!last || last.action !== "bezierCurveTo") {
      cp1x = lastPoint.x;
      cp1y = lastPoint.y;
    } else {
      cp1x = last.data[2];
      cp1y = last.data[3];
      const currentX = lastPoint.x;
      const currentY = lastPoint.y;
      cp1x = currentX + (currentX - cp1x);
      cp1y = currentY + (currentY - cp1y);
    }
    this.instructions.push({ action: "bezierCurveTo", data: [cp1x, cp1y, cp2x, cp2y, x, y, smoothness] });
    this._dirty = true;
    return this;
  }
  /**
   * Closes the current path by drawing a straight line back to the start.
   * If the shape is already closed or there are no points in the path, this method does nothing.
   * @returns The instance of the current object for chaining.
   */
  closePath() {
    this.instructions.push({ action: "closePath", data: [] });
    this._dirty = true;
    return this;
  }
  ellipse(...args) {
    this.instructions.push({ action: "ellipse", data: args });
    this._dirty = true;
    return this;
  }
  lineTo(...args) {
    this.instructions.push({ action: "lineTo", data: args });
    this._dirty = true;
    return this;
  }
  moveTo(...args) {
    this.instructions.push({ action: "moveTo", data: args });
    return this;
  }
  quadraticCurveTo(...args) {
    this.instructions.push({ action: "quadraticCurveTo", data: args });
    this._dirty = true;
    return this;
  }
  /**
   * Adds a quadratic curve to the path. It uses the previous point as the control point.
   * @param x - The x-coordinate of the end point.
   * @param y - The y-coordinate of the end point.
   * @param smoothness - Optional parameter to adjust the smoothness of the curve.
   * @returns The instance of the current object for chaining.
   */
  quadraticCurveToShort(x, y, smoothness) {
    const last = this.instructions[this.instructions.length - 1];
    const lastPoint = this.getLastPoint(Point/* Point */.b.shared);
    let cpx1 = 0;
    let cpy1 = 0;
    if (!last || last.action !== "quadraticCurveTo") {
      cpx1 = lastPoint.x;
      cpy1 = lastPoint.y;
    } else {
      cpx1 = last.data[0];
      cpy1 = last.data[1];
      const currentX = lastPoint.x;
      const currentY = lastPoint.y;
      cpx1 = currentX + (currentX - cpx1);
      cpy1 = currentY + (currentY - cpy1);
    }
    this.instructions.push({ action: "quadraticCurveTo", data: [cpx1, cpy1, x, y, smoothness] });
    this._dirty = true;
    return this;
  }
  /**
   * Draws a rectangle shape. This method adds a new rectangle path to the current drawing.
   * @param x - The x-coordinate of the top-left corner of the rectangle.
   * @param y - The y-coordinate of the top-left corner of the rectangle.
   * @param w - The width of the rectangle.
   * @param h - The height of the rectangle.
   * @param transform - An optional `Matrix` object to apply a transformation to the rectangle.
   * @returns The instance of the current object for chaining.
   */
  rect(x, y, w, h, transform) {
    this.instructions.push({ action: "rect", data: [x, y, w, h, transform] });
    this._dirty = true;
    return this;
  }
  /**
   * Draws a circle shape. This method adds a new circle path to the current drawing.
   * @param x - The x-coordinate of the center of the circle.
   * @param y - The y-coordinate of the center of the circle.
   * @param radius - The radius of the circle.
   * @param transform - An optional `Matrix` object to apply a transformation to the circle.
   * @returns The instance of the current object for chaining.
   */
  circle(x, y, radius, transform) {
    this.instructions.push({ action: "circle", data: [x, y, radius, transform] });
    this._dirty = true;
    return this;
  }
  roundRect(...args) {
    this.instructions.push({ action: "roundRect", data: args });
    this._dirty = true;
    return this;
  }
  poly(...args) {
    this.instructions.push({ action: "poly", data: args });
    this._dirty = true;
    return this;
  }
  regularPoly(...args) {
    this.instructions.push({ action: "regularPoly", data: args });
    this._dirty = true;
    return this;
  }
  roundPoly(...args) {
    this.instructions.push({ action: "roundPoly", data: args });
    this._dirty = true;
    return this;
  }
  roundShape(...args) {
    this.instructions.push({ action: "roundShape", data: args });
    this._dirty = true;
    return this;
  }
  filletRect(...args) {
    this.instructions.push({ action: "filletRect", data: args });
    this._dirty = true;
    return this;
  }
  chamferRect(...args) {
    this.instructions.push({ action: "chamferRect", data: args });
    this._dirty = true;
    return this;
  }
  /**
   * Draws a star shape centered at a specified location. This method allows for the creation
   *  of stars with a variable number of points, outer radius, optional inner radius, and rotation.
   * The star is drawn as a closed polygon with alternating outer and inner vertices to create the star's points.
   * An optional transformation can be applied to scale, rotate, or translate the star as needed.
   * @param x - The x-coordinate of the center of the star.
   * @param y - The y-coordinate of the center of the star.
   * @param points - The number of points of the star.
   * @param radius - The outer radius of the star (distance from the center to the outer points).
   * @param innerRadius - Optional. The inner radius of the star
   * (distance from the center to the inner points between the outer points).
   * If not provided, defaults to half of the `radius`.
   * @param rotation - Optional. The rotation of the star in radians, where 0 is aligned with the y-axis.
   * Defaults to 0, meaning one point is directly upward.
   * @param transform - An optional `Matrix` object to apply a transformation to the star.
   * This can include rotations, scaling, and translations.
   * @returns The instance of the current object for chaining further drawing commands.
   */
  // eslint-disable-next-line max-len
  star(x, y, points, radius, innerRadius, rotation, transform) {
    innerRadius || (innerRadius = radius / 2);
    const startAngle = -1 * Math.PI / 2 + rotation;
    const len = points * 2;
    const delta = Math.PI * 2 / len;
    const polygon = [];
    for (let i = 0; i < len; i++) {
      const r = i % 2 ? innerRadius : radius;
      const angle = i * delta + startAngle;
      polygon.push(
        x + r * Math.cos(angle),
        y + r * Math.sin(angle)
      );
    }
    this.poly(polygon, true, transform);
    return this;
  }
  /**
   * Creates a copy of the current `GraphicsPath` instance. This method supports both shallow and deep cloning.
   * A shallow clone copies the reference of the instructions array, while a deep clone creates a new array and
   * copies each instruction individually, ensuring that modifications to the instructions of the cloned `GraphicsPath`
   * do not affect the original `GraphicsPath` and vice versa.
   * @param deep - A boolean flag indicating whether the clone should be deep.
   * @returns A new `GraphicsPath` instance that is a clone of the current instance.
   */
  clone(deep = false) {
    const newGraphicsPath2D = new GraphicsPath();
    newGraphicsPath2D.checkForHoles = this.checkForHoles;
    if (!deep) {
      newGraphicsPath2D.instructions = this.instructions.slice();
    } else {
      for (let i = 0; i < this.instructions.length; i++) {
        const instruction = this.instructions[i];
        newGraphicsPath2D.instructions.push({ action: instruction.action, data: instruction.data.slice() });
      }
    }
    return newGraphicsPath2D;
  }
  clear() {
    this.instructions.length = 0;
    this._dirty = true;
    return this;
  }
  /**
   * Applies a transformation matrix to all drawing instructions within the `GraphicsPath`.
   * This method enables the modification of the path's geometry according to the provided
   * transformation matrix, which can include translations, rotations, scaling, and skewing.
   *
   * Each drawing instruction in the path is updated to reflect the transformation,
   * ensuring the visual representation of the path is consistent with the applied matrix.
   *
   * Note: The transformation is applied directly to the coordinates and control points of the drawing instructions,
   * not to the path as a whole. This means the transformation's effects are baked into the individual instructions,
   * allowing for fine-grained control over the path's appearance.
   * @param matrix - A `Matrix` object representing the transformation to apply.
   * @returns The instance of the current object for chaining further operations.
   */
  transform(matrix) {
    if (matrix.isIdentity())
      return this;
    const a = matrix.a;
    const b = matrix.b;
    const c = matrix.c;
    const d = matrix.d;
    const tx = matrix.tx;
    const ty = matrix.ty;
    let x = 0;
    let y = 0;
    let cpx1 = 0;
    let cpy1 = 0;
    let cpx2 = 0;
    let cpy2 = 0;
    let rx = 0;
    let ry = 0;
    for (let i = 0; i < this.instructions.length; i++) {
      const instruction = this.instructions[i];
      const data = instruction.data;
      switch (instruction.action) {
        case "moveTo":
        case "lineTo":
          x = data[0];
          y = data[1];
          data[0] = a * x + c * y + tx;
          data[1] = b * x + d * y + ty;
          break;
        case "bezierCurveTo":
          cpx1 = data[0];
          cpy1 = data[1];
          cpx2 = data[2];
          cpy2 = data[3];
          x = data[4];
          y = data[5];
          data[0] = a * cpx1 + c * cpy1 + tx;
          data[1] = b * cpx1 + d * cpy1 + ty;
          data[2] = a * cpx2 + c * cpy2 + tx;
          data[3] = b * cpx2 + d * cpy2 + ty;
          data[4] = a * x + c * y + tx;
          data[5] = b * x + d * y + ty;
          break;
        case "quadraticCurveTo":
          cpx1 = data[0];
          cpy1 = data[1];
          x = data[2];
          y = data[3];
          data[0] = a * cpx1 + c * cpy1 + tx;
          data[1] = b * cpx1 + d * cpy1 + ty;
          data[2] = a * x + c * y + tx;
          data[3] = b * x + d * y + ty;
          break;
        case "arcToSvg":
          x = data[5];
          y = data[6];
          rx = data[0];
          ry = data[1];
          data[0] = a * rx + c * ry;
          data[1] = b * rx + d * ry;
          data[5] = a * x + c * y + tx;
          data[6] = b * x + d * y + ty;
          break;
        case "circle":
          data[4] = adjustTransform(data[3], matrix);
          break;
        case "rect":
          data[4] = adjustTransform(data[4], matrix);
          break;
        case "ellipse":
          data[8] = adjustTransform(data[8], matrix);
          break;
        case "roundRect":
          data[5] = adjustTransform(data[5], matrix);
          break;
        case "addPath":
          data[0].transform(matrix);
          break;
        case "poly":
          data[2] = adjustTransform(data[2], matrix);
          break;
        default:
          (0,warn/* warn */.R)("unknown transform action", instruction.action);
          break;
      }
    }
    this._dirty = true;
    return this;
  }
  get bounds() {
    return this.shapePath.bounds;
  }
  /**
   * Retrieves the last point from the current drawing instructions in the `GraphicsPath`.
   * This method is useful for operations that depend on the path's current endpoint,
   * such as connecting subsequent shapes or paths. It supports various drawing instructions,
   * ensuring the last point's position is accurately determined regardless of the path's complexity.
   *
   * If the last instruction is a `closePath`, the method iterates backward through the instructions
   *  until it finds an actionable instruction that defines a point (e.g., `moveTo`, `lineTo`,
   * `quadraticCurveTo`, etc.). For compound paths added via `addPath`, it recursively retrieves
   * the last point from the nested path.
   * @param out - A `Point` object where the last point's coordinates will be stored.
   * This object is modified directly to contain the result.
   * @returns The `Point` object containing the last point's coordinates.
   */
  getLastPoint(out) {
    let index = this.instructions.length - 1;
    let lastInstruction = this.instructions[index];
    if (!lastInstruction) {
      out.x = 0;
      out.y = 0;
      return out;
    }
    while (lastInstruction.action === "closePath") {
      index--;
      if (index < 0) {
        out.x = 0;
        out.y = 0;
        return out;
      }
      lastInstruction = this.instructions[index];
    }
    switch (lastInstruction.action) {
      case "moveTo":
      case "lineTo":
        out.x = lastInstruction.data[0];
        out.y = lastInstruction.data[1];
        break;
      case "quadraticCurveTo":
        out.x = lastInstruction.data[2];
        out.y = lastInstruction.data[3];
        break;
      case "bezierCurveTo":
        out.x = lastInstruction.data[4];
        out.y = lastInstruction.data[5];
        break;
      case "arc":
      case "arcToSvg":
        out.x = lastInstruction.data[5];
        out.y = lastInstruction.data[6];
        break;
      case "addPath":
        lastInstruction.data[0].getLastPoint(out);
        break;
    }
    return out;
  }
}
function adjustTransform(currentMatrix, transform) {
  if (currentMatrix) {
    return currentMatrix.prepend(transform);
  }
  return transform.clone();
}


//# sourceMappingURL=GraphicsPath.mjs.map

// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/graphics/shared/fill/FillGradient.mjs
var FillGradient = __webpack_require__(7276);
;// ./node_modules/pixi.js/lib/scene/graphics/shared/svg/parseSVGFloatAttribute.mjs

function parseSVGFloatAttribute(svg, id, defaultValue) {
  const value = svg.getAttribute(id);
  return value ? Number(value) : defaultValue;
}


//# sourceMappingURL=parseSVGFloatAttribute.mjs.map

;// ./node_modules/pixi.js/lib/scene/graphics/shared/svg/parseSVGDefinitions.mjs





"use strict";
function parseSVGDefinitions(svg, session) {
  const definitions = svg.querySelectorAll("defs");
  for (let i = 0; i < definitions.length; i++) {
    const definition = definitions[i];
    for (let j = 0; j < definition.children.length; j++) {
      const child = definition.children[j];
      switch (child.nodeName.toLowerCase()) {
        case "lineargradient":
          session.defs[child.id] = parseLinearGradient(child);
          break;
        case "radialgradient":
          session.defs[child.id] = parseRadialGradient(child);
          break;
        default:
          break;
      }
    }
  }
}
function parseLinearGradient(child) {
  const x0 = parseSVGFloatAttribute(child, "x1", 0);
  const y0 = parseSVGFloatAttribute(child, "y1", 0);
  const x1 = parseSVGFloatAttribute(child, "x2", 1);
  const y1 = parseSVGFloatAttribute(child, "y2", 0);
  const gradientUnit = child.getAttribute("gradientUnits") || "objectBoundingBox";
  const gradient = new FillGradient/* FillGradient */._(
    x0,
    y0,
    x1,
    y1,
    gradientUnit === "objectBoundingBox" ? "local" : "global"
  );
  for (let k = 0; k < child.children.length; k++) {
    const stop = child.children[k];
    const offset = parseSVGFloatAttribute(stop, "offset", 0);
    const color = Color/* Color */.Q.shared.setValue(stop.getAttribute("stop-color")).toNumber();
    gradient.addColorStop(offset, color);
  }
  return gradient;
}
function parseRadialGradient(_child) {
  (0,warn/* warn */.R)("[SVG Parser] Radial gradients are not yet supported");
  return new FillGradient/* FillGradient */._(0, 0, 1, 0);
}


//# sourceMappingURL=parseSVGDefinitions.mjs.map

;// ./node_modules/pixi.js/lib/scene/graphics/shared/svg/utils/extractSvgUrlId.mjs

function extractSvgUrlId(url) {
  const match = url.match(/url\s*\(\s*['"]?\s*#([^'"\s)]+)\s*['"]?\s*\)/i);
  return match ? match[1] : "";
}


//# sourceMappingURL=extractSvgUrlId.mjs.map

;// ./node_modules/pixi.js/lib/scene/graphics/shared/svg/parseSVGStyle.mjs



"use strict";
const styleAttributes = {
  // Fill properties
  fill: { type: "paint", default: 0 },
  // Fill color/gradient
  "fill-opacity": { type: "number", default: 1 },
  // Fill transparency
  // Stroke properties
  stroke: { type: "paint", default: 0 },
  // Stroke color/gradient
  "stroke-width": { type: "number", default: 1 },
  // Width of stroke
  "stroke-opacity": { type: "number", default: 1 },
  // Stroke transparency
  "stroke-linecap": { type: "string", default: "butt" },
  // End cap style: butt, round, square
  "stroke-linejoin": { type: "string", default: "miter" },
  // Join style: miter, round, bevel
  "stroke-miterlimit": { type: "number", default: 10 },
  // Limit on miter join sharpness
  "stroke-dasharray": { type: "string", default: "none" },
  // Dash pattern
  "stroke-dashoffset": { type: "number", default: 0 },
  // Offset for dash pattern
  // Global properties
  opacity: { type: "number", default: 1 }
  // Overall opacity
};
function parseSVGStyle(svg, session) {
  const style = svg.getAttribute("style");
  const strokeStyle = {};
  const fillStyle = {};
  const result = {
    strokeStyle,
    fillStyle,
    useFill: false,
    useStroke: false
  };
  for (const key in styleAttributes) {
    const attribute = svg.getAttribute(key);
    if (attribute) {
      parseAttribute(session, result, key, attribute.trim());
    }
  }
  if (style) {
    const styleParts = style.split(";");
    for (let i = 0; i < styleParts.length; i++) {
      const stylePart = styleParts[i].trim();
      const [key, value] = stylePart.split(":");
      if (styleAttributes[key]) {
        parseAttribute(session, result, key, value.trim());
      }
    }
  }
  return {
    strokeStyle: result.useStroke ? strokeStyle : null,
    fillStyle: result.useFill ? fillStyle : null,
    useFill: result.useFill,
    useStroke: result.useStroke
  };
}
function parseAttribute(session, result, id, value) {
  switch (id) {
    case "stroke":
      if (value !== "none") {
        if (value.startsWith("url(")) {
          const id2 = extractSvgUrlId(value);
          result.strokeStyle.fill = session.defs[id2];
        } else {
          result.strokeStyle.color = Color/* Color */.Q.shared.setValue(value).toNumber();
        }
        result.useStroke = true;
      }
      break;
    case "stroke-width":
      result.strokeStyle.width = Number(value);
      break;
    case "fill":
      if (value !== "none") {
        if (value.startsWith("url(")) {
          const id2 = extractSvgUrlId(value);
          result.fillStyle.fill = session.defs[id2];
        } else {
          result.fillStyle.color = Color/* Color */.Q.shared.setValue(value).toNumber();
        }
        result.useFill = true;
      }
      break;
    case "fill-opacity":
      result.fillStyle.alpha = Number(value);
      break;
    case "stroke-opacity":
      result.strokeStyle.alpha = Number(value);
      break;
    case "opacity":
      result.fillStyle.alpha = Number(value);
      result.strokeStyle.alpha = Number(value);
      break;
  }
}


//# sourceMappingURL=parseSVGStyle.mjs.map

;// ./node_modules/pixi.js/lib/scene/graphics/shared/svg/utils/fillOperations.mjs

function checkForNestedPattern(subpathsWithArea) {
  if (subpathsWithArea.length <= 2) {
    return true;
  }
  const areas = subpathsWithArea.map((s) => s.area).sort((a, b) => b - a);
  const [largestArea, secondArea] = areas;
  const smallestArea = areas[areas.length - 1];
  const largestToSecondRatio = largestArea / secondArea;
  const secondToSmallestRatio = secondArea / smallestArea;
  if (largestToSecondRatio > 3 && secondToSmallestRatio < 2) {
    return false;
  }
  return true;
}
function getFillInstructionData(context, index = 0) {
  const instruction = context.instructions[index];
  if (!instruction || instruction.action !== "fill") {
    throw new Error(`Expected fill instruction at index ${index}, got ${instruction?.action || "undefined"}`);
  }
  return instruction.data;
}


//# sourceMappingURL=fillOperations.mjs.map

;// ./node_modules/pixi.js/lib/scene/graphics/shared/svg/utils/pathOperations.mjs


"use strict";
function extractSubpaths(pathData) {
  const parts = pathData.split(/(?=[Mm])/);
  const subpaths = parts.filter((part) => part.trim().length > 0);
  return subpaths;
}
function calculatePathArea(pathData) {
  const coords = pathData.match(/[-+]?[0-9]*\.?[0-9]+/g);
  if (!coords || coords.length < 4)
    return 0;
  const numbers = coords.map(Number);
  const xs = [];
  const ys = [];
  for (let i = 0; i < numbers.length; i += 2) {
    if (i + 1 < numbers.length) {
      xs.push(numbers[i]);
      ys.push(numbers[i + 1]);
    }
  }
  if (xs.length === 0 || ys.length === 0)
    return 0;
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const area = (maxX - minX) * (maxY - minY);
  return area;
}
function appendSVGPath(pathData, graphicsPath) {
  const tempPath = new GraphicsPath(pathData, false);
  for (const instruction of tempPath.instructions) {
    graphicsPath.instructions.push(instruction);
  }
}


//# sourceMappingURL=pathOperations.mjs.map

;// ./node_modules/pixi.js/lib/scene/graphics/shared/svg/SVGParser.mjs








"use strict";
function SVGParser(svg, graphicsContext) {
  if (typeof svg === "string") {
    const div = document.createElement("div");
    div.innerHTML = svg.trim();
    svg = div.querySelector("svg");
  }
  const session = {
    context: graphicsContext,
    defs: {},
    path: new GraphicsPath()
  };
  parseSVGDefinitions(svg, session);
  const children = svg.children;
  const { fillStyle, strokeStyle } = parseSVGStyle(svg, session);
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child.nodeName.toLowerCase() === "defs")
      continue;
    renderChildren(child, session, fillStyle, strokeStyle);
  }
  return graphicsContext;
}
function renderChildren(svg, session, fillStyle, strokeStyle) {
  const children = svg.children;
  const { fillStyle: f1, strokeStyle: s1 } = parseSVGStyle(svg, session);
  if (f1 && fillStyle) {
    fillStyle = { ...fillStyle, ...f1 };
  } else if (f1) {
    fillStyle = f1;
  }
  if (s1 && strokeStyle) {
    strokeStyle = { ...strokeStyle, ...s1 };
  } else if (s1) {
    strokeStyle = s1;
  }
  const noStyle = !fillStyle && !strokeStyle;
  if (noStyle) {
    fillStyle = { color: 0 };
  }
  let x;
  let y;
  let x1;
  let y1;
  let x2;
  let y2;
  let cx;
  let cy;
  let r;
  let rx;
  let ry;
  let points;
  let pointsString;
  let d;
  let graphicsPath;
  let width;
  let height;
  switch (svg.nodeName.toLowerCase()) {
    case "path": {
      d = svg.getAttribute("d");
      const fillRule = svg.getAttribute("fill-rule");
      const subpaths = extractSubpaths(d);
      const hasExplicitEvenodd = fillRule === "evenodd";
      const hasMultipleSubpaths = subpaths.length > 1;
      const shouldProcessHoles = hasExplicitEvenodd && hasMultipleSubpaths;
      if (shouldProcessHoles) {
        const subpathsWithArea = subpaths.map((subpath) => ({
          path: subpath,
          area: calculatePathArea(subpath)
        }));
        subpathsWithArea.sort((a, b) => b.area - a.area);
        const useMultipleHolesApproach = subpaths.length > 3 || !checkForNestedPattern(subpathsWithArea);
        if (useMultipleHolesApproach) {
          for (let i = 0; i < subpathsWithArea.length; i++) {
            const subpath = subpathsWithArea[i];
            const isMainShape = i === 0;
            session.context.beginPath();
            const newPath = new GraphicsPath(void 0, true);
            appendSVGPath(subpath.path, newPath);
            session.context.path(newPath);
            if (isMainShape) {
              if (fillStyle)
                session.context.fill(fillStyle);
              if (strokeStyle)
                session.context.stroke(strokeStyle);
            } else {
              session.context.cut();
            }
          }
        } else {
          for (let i = 0; i < subpathsWithArea.length; i++) {
            const subpath = subpathsWithArea[i];
            const isHole = i % 2 === 1;
            session.context.beginPath();
            const newPath = new GraphicsPath(void 0, true);
            appendSVGPath(subpath.path, newPath);
            session.context.path(newPath);
            if (isHole) {
              session.context.cut();
            } else {
              if (fillStyle)
                session.context.fill(fillStyle);
              if (strokeStyle)
                session.context.stroke(strokeStyle);
            }
          }
        }
      } else {
        const useEvenoddForGraphicsPath = fillRule ? fillRule === "evenodd" : true;
        graphicsPath = new GraphicsPath(d, useEvenoddForGraphicsPath);
        session.context.path(graphicsPath);
        if (fillStyle)
          session.context.fill(fillStyle);
        if (strokeStyle)
          session.context.stroke(strokeStyle);
      }
      break;
    }
    case "circle":
      cx = parseSVGFloatAttribute(svg, "cx", 0);
      cy = parseSVGFloatAttribute(svg, "cy", 0);
      r = parseSVGFloatAttribute(svg, "r", 0);
      session.context.ellipse(cx, cy, r, r);
      if (fillStyle)
        session.context.fill(fillStyle);
      if (strokeStyle)
        session.context.stroke(strokeStyle);
      break;
    case "rect":
      x = parseSVGFloatAttribute(svg, "x", 0);
      y = parseSVGFloatAttribute(svg, "y", 0);
      width = parseSVGFloatAttribute(svg, "width", 0);
      height = parseSVGFloatAttribute(svg, "height", 0);
      rx = parseSVGFloatAttribute(svg, "rx", 0);
      ry = parseSVGFloatAttribute(svg, "ry", 0);
      if (rx || ry) {
        session.context.roundRect(x, y, width, height, rx || ry);
      } else {
        session.context.rect(x, y, width, height);
      }
      if (fillStyle)
        session.context.fill(fillStyle);
      if (strokeStyle)
        session.context.stroke(strokeStyle);
      break;
    case "ellipse":
      cx = parseSVGFloatAttribute(svg, "cx", 0);
      cy = parseSVGFloatAttribute(svg, "cy", 0);
      rx = parseSVGFloatAttribute(svg, "rx", 0);
      ry = parseSVGFloatAttribute(svg, "ry", 0);
      session.context.beginPath();
      session.context.ellipse(cx, cy, rx, ry);
      if (fillStyle)
        session.context.fill(fillStyle);
      if (strokeStyle)
        session.context.stroke(strokeStyle);
      break;
    case "line":
      x1 = parseSVGFloatAttribute(svg, "x1", 0);
      y1 = parseSVGFloatAttribute(svg, "y1", 0);
      x2 = parseSVGFloatAttribute(svg, "x2", 0);
      y2 = parseSVGFloatAttribute(svg, "y2", 0);
      session.context.beginPath();
      session.context.moveTo(x1, y1);
      session.context.lineTo(x2, y2);
      if (strokeStyle)
        session.context.stroke(strokeStyle);
      break;
    case "polygon":
      pointsString = svg.getAttribute("points");
      points = pointsString.match(/\d+/g).map((n) => parseInt(n, 10));
      session.context.poly(points, true);
      if (fillStyle)
        session.context.fill(fillStyle);
      if (strokeStyle)
        session.context.stroke(strokeStyle);
      break;
    case "polyline":
      pointsString = svg.getAttribute("points");
      points = pointsString.match(/\d+/g).map((n) => parseInt(n, 10));
      session.context.poly(points, false);
      if (strokeStyle)
        session.context.stroke(strokeStyle);
      break;
    case "g":
    case "svg":
      break;
    default: {
      (0,warn/* warn */.R)(`[SVG parser] <${svg.nodeName}> elements unsupported`);
      break;
    }
  }
  if (noStyle) {
    fillStyle = null;
  }
  for (let i = 0; i < children.length; i++) {
    renderChildren(children[i], session, fillStyle, strokeStyle);
  }
}


//# sourceMappingURL=SVGParser.mjs.map

// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/graphics/shared/utils/convertFillInputToFillStyle.mjs
var convertFillInputToFillStyle = __webpack_require__(990);
;// ./node_modules/pixi.js/lib/scene/graphics/shared/GraphicsContext.mjs












"use strict";
const tmpPoint = new Point/* Point */.b();
const tempMatrix = new Matrix/* Matrix */.u();
const _GraphicsContext = class _GraphicsContext extends eventemitter3/* default */.A {
  constructor() {
    super(...arguments);
    /**
     * unique id for this graphics context
     * @internal
     */
    this.uid = (0,uid/* uid */.L)("graphicsContext");
    /**
     * Indicates whether content is updated and have to be re-rendered.
     * @internal
     */
    this.dirty = true;
    /** The batch mode for this graphics context. It can be 'auto', 'batch', or 'no-batch'. */
    this.batchMode = "auto";
    /** @internal */
    this.instructions = [];
    this._activePath = new GraphicsPath();
    this._transform = new Matrix/* Matrix */.u();
    this._fillStyle = { ..._GraphicsContext.defaultFillStyle };
    this._strokeStyle = { ..._GraphicsContext.defaultStrokeStyle };
    this._stateStack = [];
    this._tick = 0;
    this._bounds = new Bounds/* Bounds */.c();
    this._boundsDirty = true;
  }
  /**
   * Creates a new GraphicsContext object that is a clone of this instance, copying all properties,
   * including the current drawing state, transformations, styles, and instructions.
   * @returns A new GraphicsContext instance with the same properties and state as this one.
   */
  clone() {
    const clone = new _GraphicsContext();
    clone.batchMode = this.batchMode;
    clone.instructions = this.instructions.slice();
    clone._activePath = this._activePath.clone();
    clone._transform = this._transform.clone();
    clone._fillStyle = { ...this._fillStyle };
    clone._strokeStyle = { ...this._strokeStyle };
    clone._stateStack = this._stateStack.slice();
    clone._bounds = this._bounds.clone();
    clone._boundsDirty = true;
    return clone;
  }
  /**
   * The current fill style of the graphics context. This can be a color, gradient, pattern, or a more complex style defined by a FillStyle object.
   */
  get fillStyle() {
    return this._fillStyle;
  }
  set fillStyle(value) {
    this._fillStyle = (0,convertFillInputToFillStyle/* toFillStyle */.w)(value, _GraphicsContext.defaultFillStyle);
  }
  /**
   * The current stroke style of the graphics context. Similar to fill styles, stroke styles can encompass colors, gradients, patterns, or more detailed configurations via a StrokeStyle object.
   */
  get strokeStyle() {
    return this._strokeStyle;
  }
  set strokeStyle(value) {
    this._strokeStyle = (0,convertFillInputToFillStyle/* toStrokeStyle */.T)(value, _GraphicsContext.defaultStrokeStyle);
  }
  /**
   * Sets the current fill style of the graphics context. The fill style can be a color, gradient,
   * pattern, or a more complex style defined by a FillStyle object.
   * @param style - The fill style to apply. This can be a simple color, a gradient or pattern object,
   *                or a FillStyle or ConvertedFillStyle object.
   * @returns The instance of the current GraphicsContext for method chaining.
   */
  setFillStyle(style) {
    this._fillStyle = (0,convertFillInputToFillStyle/* toFillStyle */.w)(style, _GraphicsContext.defaultFillStyle);
    return this;
  }
  /**
   * Sets the current stroke style of the graphics context. Similar to fill styles, stroke styles can
   * encompass colors, gradients, patterns, or more detailed configurations via a StrokeStyle object.
   * @param style - The stroke style to apply. Can be defined as a color, a gradient or pattern,
   *                or a StrokeStyle or ConvertedStrokeStyle object.
   * @returns The instance of the current GraphicsContext for method chaining.
   */
  setStrokeStyle(style) {
    this._strokeStyle = (0,convertFillInputToFillStyle/* toFillStyle */.w)(style, _GraphicsContext.defaultStrokeStyle);
    return this;
  }
  texture(texture, tint, dx, dy, dw, dh) {
    this.instructions.push({
      action: "texture",
      data: {
        image: texture,
        dx: dx || 0,
        dy: dy || 0,
        dw: dw || texture.frame.width,
        dh: dh || texture.frame.height,
        transform: this._transform.clone(),
        alpha: this._fillStyle.alpha,
        style: tint ? Color/* Color */.Q.shared.setValue(tint).toNumber() : 16777215
      }
    });
    this.onUpdate();
    return this;
  }
  /**
   * Resets the current path. Any previous path and its commands are discarded and a new path is
   * started. This is typically called before beginning a new shape or series of drawing commands.
   * @returns The instance of the current GraphicsContext for method chaining.
   */
  beginPath() {
    this._activePath = new GraphicsPath();
    return this;
  }
  fill(style, alpha) {
    let path;
    const lastInstruction = this.instructions[this.instructions.length - 1];
    if (this._tick === 0 && lastInstruction && lastInstruction.action === "stroke") {
      path = lastInstruction.data.path;
    } else {
      path = this._activePath.clone();
    }
    if (!path)
      return this;
    if (style != null) {
      if (alpha !== void 0 && typeof style === "number") {
        (0,deprecation/* deprecation */.t6)(deprecation/* v8_0_0 */.lj, "GraphicsContext.fill(color, alpha) is deprecated, use GraphicsContext.fill({ color, alpha }) instead");
        style = { color: style, alpha };
      }
      this._fillStyle = (0,convertFillInputToFillStyle/* toFillStyle */.w)(style, _GraphicsContext.defaultFillStyle);
    }
    this.instructions.push({
      action: "fill",
      // TODO copy fill style!
      data: { style: this.fillStyle, path }
    });
    this.onUpdate();
    this._initNextPathLocation();
    this._tick = 0;
    return this;
  }
  _initNextPathLocation() {
    const { x, y } = this._activePath.getLastPoint(Point/* Point */.b.shared);
    this._activePath.clear();
    this._activePath.moveTo(x, y);
  }
  /**
   * Strokes the current path with the current stroke style. This method can take an optional
   * FillInput parameter to define the stroke's appearance, including its color, width, and other properties.
   * @param style - (Optional) The stroke style to apply. Can be defined as a simple color or a more complex style object. If omitted, uses the current stroke style.
   * @returns The instance of the current GraphicsContext for method chaining.
   */
  stroke(style) {
    let path;
    const lastInstruction = this.instructions[this.instructions.length - 1];
    if (this._tick === 0 && lastInstruction && lastInstruction.action === "fill") {
      path = lastInstruction.data.path;
    } else {
      path = this._activePath.clone();
    }
    if (!path)
      return this;
    if (style != null) {
      this._strokeStyle = (0,convertFillInputToFillStyle/* toStrokeStyle */.T)(style, _GraphicsContext.defaultStrokeStyle);
    }
    this.instructions.push({
      action: "stroke",
      // TODO copy fill style!
      data: { style: this.strokeStyle, path }
    });
    this.onUpdate();
    this._initNextPathLocation();
    this._tick = 0;
    return this;
  }
  /**
   * Applies a cutout to the last drawn shape. This is used to create holes or complex shapes by
   * subtracting a path from the previously drawn path. If a hole is not completely in a shape, it will
   * fail to cut correctly!
   * @returns The instance of the current GraphicsContext for method chaining.
   */
  cut() {
    for (let i = 0; i < 2; i++) {
      const lastInstruction = this.instructions[this.instructions.length - 1 - i];
      const holePath = this._activePath.clone();
      if (lastInstruction) {
        if (lastInstruction.action === "stroke" || lastInstruction.action === "fill") {
          if (lastInstruction.data.hole) {
            lastInstruction.data.hole.addPath(holePath);
          } else {
            lastInstruction.data.hole = holePath;
            break;
          }
        }
      }
    }
    this._initNextPathLocation();
    return this;
  }
  /**
   * Adds an arc to the current path, which is centered at (x, y) with the specified radius,
   * starting and ending angles, and direction.
   * @param x - The x-coordinate of the arc's center.
   * @param y - The y-coordinate of the arc's center.
   * @param radius - The arc's radius.
   * @param startAngle - The starting angle, in radians.
   * @param endAngle - The ending angle, in radians.
   * @param counterclockwise - (Optional) Specifies whether the arc is drawn counterclockwise (true) or clockwise (false). Defaults to false.
   * @returns The instance of the current GraphicsContext for method chaining.
   */
  arc(x, y, radius, startAngle, endAngle, counterclockwise) {
    this._tick++;
    const t = this._transform;
    this._activePath.arc(
      t.a * x + t.c * y + t.tx,
      t.b * x + t.d * y + t.ty,
      radius,
      startAngle,
      endAngle,
      counterclockwise
    );
    return this;
  }
  /**
   * Adds an arc to the current path with the given control points and radius, connected to the previous point
   * by a straight line if necessary.
   * @param x1 - The x-coordinate of the first control point.
   * @param y1 - The y-coordinate of the first control point.
   * @param x2 - The x-coordinate of the second control point.
   * @param y2 - The y-coordinate of the second control point.
   * @param radius - The arc's radius.
   * @returns The instance of the current GraphicsContext for method chaining.
   */
  arcTo(x1, y1, x2, y2, radius) {
    this._tick++;
    const t = this._transform;
    this._activePath.arcTo(
      t.a * x1 + t.c * y1 + t.tx,
      t.b * x1 + t.d * y1 + t.ty,
      t.a * x2 + t.c * y2 + t.tx,
      t.b * x2 + t.d * y2 + t.ty,
      radius
    );
    return this;
  }
  /**
   * Adds an SVG-style arc to the path, allowing for elliptical arcs based on the SVG spec.
   * @param rx - The x-radius of the ellipse.
   * @param ry - The y-radius of the ellipse.
   * @param xAxisRotation - The rotation of the ellipse's x-axis relative
   * to the x-axis of the coordinate system, in degrees.
   * @param largeArcFlag - Determines if the arc should be greater than or less than 180 degrees.
   * @param sweepFlag - Determines if the arc should be swept in a positive angle direction.
   * @param x - The x-coordinate of the arc's end point.
   * @param y - The y-coordinate of the arc's end point.
   * @returns The instance of the current object for chaining.
   */
  arcToSvg(rx, ry, xAxisRotation, largeArcFlag, sweepFlag, x, y) {
    this._tick++;
    const t = this._transform;
    this._activePath.arcToSvg(
      rx,
      ry,
      xAxisRotation,
      // should we rotate this with transform??
      largeArcFlag,
      sweepFlag,
      t.a * x + t.c * y + t.tx,
      t.b * x + t.d * y + t.ty
    );
    return this;
  }
  /**
   * Adds a cubic Bezier curve to the path.
   * It requires three points: the first two are control points and the third one is the end point.
   * The starting point is the last point in the current path.
   * @param cp1x - The x-coordinate of the first control point.
   * @param cp1y - The y-coordinate of the first control point.
   * @param cp2x - The x-coordinate of the second control point.
   * @param cp2y - The y-coordinate of the second control point.
   * @param x - The x-coordinate of the end point.
   * @param y - The y-coordinate of the end point.
   * @param smoothness - Optional parameter to adjust the smoothness of the curve.
   * @returns The instance of the current object for chaining.
   */
  bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y, smoothness) {
    this._tick++;
    const t = this._transform;
    this._activePath.bezierCurveTo(
      t.a * cp1x + t.c * cp1y + t.tx,
      t.b * cp1x + t.d * cp1y + t.ty,
      t.a * cp2x + t.c * cp2y + t.tx,
      t.b * cp2x + t.d * cp2y + t.ty,
      t.a * x + t.c * y + t.tx,
      t.b * x + t.d * y + t.ty,
      smoothness
    );
    return this;
  }
  /**
   * Closes the current path by drawing a straight line back to the start.
   * If the shape is already closed or there are no points in the path, this method does nothing.
   * @returns The instance of the current object for chaining.
   */
  closePath() {
    this._tick++;
    this._activePath?.closePath();
    return this;
  }
  /**
   * Draws an ellipse at the specified location and with the given x and y radii.
   * An optional transformation can be applied, allowing for rotation, scaling, and translation.
   * @param x - The x-coordinate of the center of the ellipse.
   * @param y - The y-coordinate of the center of the ellipse.
   * @param radiusX - The horizontal radius of the ellipse.
   * @param radiusY - The vertical radius of the ellipse.
   * @returns The instance of the current object for chaining.
   */
  ellipse(x, y, radiusX, radiusY) {
    this._tick++;
    this._activePath.ellipse(x, y, radiusX, radiusY, this._transform.clone());
    return this;
  }
  /**
   * Draws a circle shape. This method adds a new circle path to the current drawing.
   * @param x - The x-coordinate of the center of the circle.
   * @param y - The y-coordinate of the center of the circle.
   * @param radius - The radius of the circle.
   * @returns The instance of the current object for chaining.
   */
  circle(x, y, radius) {
    this._tick++;
    this._activePath.circle(x, y, radius, this._transform.clone());
    return this;
  }
  /**
   * Adds another `GraphicsPath` to this path, optionally applying a transformation.
   * @param path - The `GraphicsPath` to add.
   * @returns The instance of the current object for chaining.
   */
  path(path) {
    this._tick++;
    this._activePath.addPath(path, this._transform.clone());
    return this;
  }
  /**
   * Connects the current point to a new point with a straight line. This method updates the current path.
   * @param x - The x-coordinate of the new point to connect to.
   * @param y - The y-coordinate of the new point to connect to.
   * @returns The instance of the current object for chaining.
   */
  lineTo(x, y) {
    this._tick++;
    const t = this._transform;
    this._activePath.lineTo(
      t.a * x + t.c * y + t.tx,
      t.b * x + t.d * y + t.ty
    );
    return this;
  }
  /**
   * Sets the starting point for a new sub-path. Any subsequent drawing commands are considered part of this path.
   * @param x - The x-coordinate for the starting point.
   * @param y - The y-coordinate for the starting point.
   * @returns The instance of the current object for chaining.
   */
  moveTo(x, y) {
    this._tick++;
    const t = this._transform;
    const instructions = this._activePath.instructions;
    const transformedX = t.a * x + t.c * y + t.tx;
    const transformedY = t.b * x + t.d * y + t.ty;
    if (instructions.length === 1 && instructions[0].action === "moveTo") {
      instructions[0].data[0] = transformedX;
      instructions[0].data[1] = transformedY;
      return this;
    }
    this._activePath.moveTo(
      transformedX,
      transformedY
    );
    return this;
  }
  /**
   * Adds a quadratic curve to the path. It requires two points: the control point and the end point.
   * The starting point is the last point in the current path.
   * @param cpx - The x-coordinate of the control point.
   * @param cpy - The y-coordinate of the control point.
   * @param x - The x-coordinate of the end point.
   * @param y - The y-coordinate of the end point.
   * @param smoothness - Optional parameter to adjust the smoothness of the curve.
   * @returns The instance of the current object for chaining.
   */
  quadraticCurveTo(cpx, cpy, x, y, smoothness) {
    this._tick++;
    const t = this._transform;
    this._activePath.quadraticCurveTo(
      t.a * cpx + t.c * cpy + t.tx,
      t.b * cpx + t.d * cpy + t.ty,
      t.a * x + t.c * y + t.tx,
      t.b * x + t.d * y + t.ty,
      smoothness
    );
    return this;
  }
  /**
   * Draws a rectangle shape. This method adds a new rectangle path to the current drawing.
   * @param x - The x-coordinate of the top-left corner of the rectangle.
   * @param y - The y-coordinate of the top-left corner of the rectangle.
   * @param w - The width of the rectangle.
   * @param h - The height of the rectangle.
   * @returns The instance of the current object for chaining.
   */
  rect(x, y, w, h) {
    this._tick++;
    this._activePath.rect(x, y, w, h, this._transform.clone());
    return this;
  }
  /**
   * Draws a rectangle with rounded corners.
   * The corner radius can be specified to determine how rounded the corners should be.
   * An optional transformation can be applied, which allows for rotation, scaling, and translation of the rectangle.
   * @param x - The x-coordinate of the top-left corner of the rectangle.
   * @param y - The y-coordinate of the top-left corner of the rectangle.
   * @param w - The width of the rectangle.
   * @param h - The height of the rectangle.
   * @param radius - The radius of the rectangle's corners. If not specified, corners will be sharp.
   * @returns The instance of the current object for chaining.
   */
  roundRect(x, y, w, h, radius) {
    this._tick++;
    this._activePath.roundRect(x, y, w, h, radius, this._transform.clone());
    return this;
  }
  /**
   * Draws a polygon shape by specifying a sequence of points. This method allows for the creation of complex polygons,
   * which can be both open and closed. An optional transformation can be applied, enabling the polygon to be scaled,
   * rotated, or translated as needed.
   * @param points - An array of numbers, or an array of PointData objects eg [{x,y}, {x,y}, {x,y}]
   * representing the x and y coordinates, of the polygon's vertices, in sequence.
   * @param close - A boolean indicating whether to close the polygon path. True by default.
   */
  poly(points, close) {
    this._tick++;
    this._activePath.poly(points, close, this._transform.clone());
    return this;
  }
  /**
   * Draws a regular polygon with a specified number of sides. All sides and angles are equal.
   * @param x - The x-coordinate of the center of the polygon.
   * @param y - The y-coordinate of the center of the polygon.
   * @param radius - The radius of the circumscribed circle of the polygon.
   * @param sides - The number of sides of the polygon. Must be 3 or more.
   * @param rotation - The rotation angle of the polygon, in radians. Zero by default.
   * @param transform - An optional `Matrix` object to apply a transformation to the polygon.
   * @returns The instance of the current object for chaining.
   */
  regularPoly(x, y, radius, sides, rotation = 0, transform) {
    this._tick++;
    this._activePath.regularPoly(x, y, radius, sides, rotation, transform);
    return this;
  }
  /**
   * Draws a polygon with rounded corners.
   * Similar to `regularPoly` but with the ability to round the corners of the polygon.
   * @param x - The x-coordinate of the center of the polygon.
   * @param y - The y-coordinate of the center of the polygon.
   * @param radius - The radius of the circumscribed circle of the polygon.
   * @param sides - The number of sides of the polygon. Must be 3 or more.
   * @param corner - The radius of the rounding of the corners.
   * @param rotation - The rotation angle of the polygon, in radians. Zero by default.
   * @returns The instance of the current object for chaining.
   */
  roundPoly(x, y, radius, sides, corner, rotation) {
    this._tick++;
    this._activePath.roundPoly(x, y, radius, sides, corner, rotation);
    return this;
  }
  /**
   * Draws a shape with rounded corners. This function supports custom radius for each corner of the shape.
   * Optionally, corners can be rounded using a quadratic curve instead of an arc, providing a different aesthetic.
   * @param points - An array of `RoundedPoint` representing the corners of the shape to draw.
   * A minimum of 3 points is required.
   * @param radius - The default radius for the corners.
   * This radius is applied to all corners unless overridden in `points`.
   * @param useQuadratic - If set to true, rounded corners are drawn using a quadraticCurve
   *  method instead of an arc method. Defaults to false.
   * @param smoothness - Specifies the smoothness of the curve when `useQuadratic` is true.
   * Higher values make the curve smoother.
   * @returns The instance of the current object for chaining.
   */
  roundShape(points, radius, useQuadratic, smoothness) {
    this._tick++;
    this._activePath.roundShape(points, radius, useQuadratic, smoothness);
    return this;
  }
  /**
   * Draw Rectangle with fillet corners. This is much like rounded rectangle
   * however it support negative numbers as well for the corner radius.
   * @param x - Upper left corner of rect
   * @param y - Upper right corner of rect
   * @param width - Width of rect
   * @param height - Height of rect
   * @param fillet - accept negative or positive values
   */
  filletRect(x, y, width, height, fillet) {
    this._tick++;
    this._activePath.filletRect(x, y, width, height, fillet);
    return this;
  }
  /**
   * Draw Rectangle with chamfer corners. These are angled corners.
   * @param x - Upper left corner of rect
   * @param y - Upper right corner of rect
   * @param width - Width of rect
   * @param height - Height of rect
   * @param chamfer - non-zero real number, size of corner cutout
   * @param transform
   */
  chamferRect(x, y, width, height, chamfer, transform) {
    this._tick++;
    this._activePath.chamferRect(x, y, width, height, chamfer, transform);
    return this;
  }
  /**
   * Draws a star shape centered at a specified location. This method allows for the creation
   *  of stars with a variable number of points, outer radius, optional inner radius, and rotation.
   * The star is drawn as a closed polygon with alternating outer and inner vertices to create the star's points.
   * An optional transformation can be applied to scale, rotate, or translate the star as needed.
   * @param x - The x-coordinate of the center of the star.
   * @param y - The y-coordinate of the center of the star.
   * @param points - The number of points of the star.
   * @param radius - The outer radius of the star (distance from the center to the outer points).
   * @param innerRadius - Optional. The inner radius of the star
   * (distance from the center to the inner points between the outer points).
   * If not provided, defaults to half of the `radius`.
   * @param rotation - Optional. The rotation of the star in radians, where 0 is aligned with the y-axis.
   * Defaults to 0, meaning one point is directly upward.
   * @returns The instance of the current object for chaining further drawing commands.
   */
  star(x, y, points, radius, innerRadius = 0, rotation = 0) {
    this._tick++;
    this._activePath.star(x, y, points, radius, innerRadius, rotation, this._transform.clone());
    return this;
  }
  /**
   * Parses and renders an SVG string into the graphics context. This allows for complex shapes and paths
   * defined in SVG format to be drawn within the graphics context.
   * @param svg - The SVG string to be parsed and rendered.
   */
  svg(svg) {
    this._tick++;
    SVGParser(svg, this);
    return this;
  }
  /**
   * Restores the most recently saved graphics state by popping the top of the graphics state stack.
   * This includes transformations, fill styles, and stroke styles.
   */
  restore() {
    const state = this._stateStack.pop();
    if (state) {
      this._transform = state.transform;
      this._fillStyle = state.fillStyle;
      this._strokeStyle = state.strokeStyle;
    }
    return this;
  }
  /** Saves the current graphics state, including transformations, fill styles, and stroke styles, onto a stack. */
  save() {
    this._stateStack.push({
      transform: this._transform.clone(),
      fillStyle: { ...this._fillStyle },
      strokeStyle: { ...this._strokeStyle }
    });
    return this;
  }
  /**
   * Returns the current transformation matrix of the graphics context.
   * @returns The current transformation matrix.
   */
  getTransform() {
    return this._transform;
  }
  /**
   * Resets the current transformation matrix to the identity matrix, effectively removing any transformations (rotation, scaling, translation) previously applied.
   * @returns The instance of the current GraphicsContext for method chaining.
   */
  resetTransform() {
    this._transform.identity();
    return this;
  }
  /**
   * Applies a rotation transformation to the graphics context around the current origin.
   * @param angle - The angle of rotation in radians.
   * @returns The instance of the current GraphicsContext for method chaining.
   */
  rotate(angle) {
    this._transform.rotate(angle);
    return this;
  }
  /**
   * Applies a scaling transformation to the graphics context, scaling drawings by x horizontally and by y vertically.
   * @param x - The scale factor in the horizontal direction.
   * @param y - (Optional) The scale factor in the vertical direction. If not specified, the x value is used for both directions.
   * @returns The instance of the current GraphicsContext for method chaining.
   */
  scale(x, y = x) {
    this._transform.scale(x, y);
    return this;
  }
  setTransform(a, b, c, d, dx, dy) {
    if (a instanceof Matrix/* Matrix */.u) {
      this._transform.set(a.a, a.b, a.c, a.d, a.tx, a.ty);
      return this;
    }
    this._transform.set(a, b, c, d, dx, dy);
    return this;
  }
  transform(a, b, c, d, dx, dy) {
    if (a instanceof Matrix/* Matrix */.u) {
      this._transform.append(a);
      return this;
    }
    tempMatrix.set(a, b, c, d, dx, dy);
    this._transform.append(tempMatrix);
    return this;
  }
  /**
   * Applies a translation transformation to the graphics context, moving the origin by the specified amounts.
   * @param x - The amount to translate in the horizontal direction.
   * @param y - (Optional) The amount to translate in the vertical direction. If not specified, the x value is used for both directions.
   * @returns The instance of the current GraphicsContext for method chaining.
   */
  translate(x, y = x) {
    this._transform.translate(x, y);
    return this;
  }
  /**
   * Clears all drawing commands from the graphics context, effectively resetting it. This includes clearing the path,
   * and optionally resetting transformations to the identity matrix.
   * @returns The instance of the current GraphicsContext for method chaining.
   */
  clear() {
    this._activePath.clear();
    this.instructions.length = 0;
    this.resetTransform();
    this.onUpdate();
    return this;
  }
  onUpdate() {
    this._boundsDirty = true;
    if (this.dirty)
      return;
    this.emit("update", this, 16);
    this.dirty = true;
  }
  /** The bounds of the graphic shape. */
  get bounds() {
    if (!this._boundsDirty)
      return this._bounds;
    this._boundsDirty = false;
    const bounds = this._bounds;
    bounds.clear();
    for (let i = 0; i < this.instructions.length; i++) {
      const instruction = this.instructions[i];
      const action = instruction.action;
      if (action === "fill") {
        const data = instruction.data;
        bounds.addBounds(data.path.bounds);
      } else if (action === "texture") {
        const data = instruction.data;
        bounds.addFrame(data.dx, data.dy, data.dx + data.dw, data.dy + data.dh, data.transform);
      }
      if (action === "stroke") {
        const data = instruction.data;
        const alignment = data.style.alignment;
        const outerPadding = data.style.width * (1 - alignment);
        const _bounds = data.path.bounds;
        bounds.addFrame(
          _bounds.minX - outerPadding,
          _bounds.minY - outerPadding,
          _bounds.maxX + outerPadding,
          _bounds.maxY + outerPadding
        );
      }
    }
    return bounds;
  }
  /**
   * Check to see if a point is contained within this geometry.
   * @param point - Point to check if it's contained.
   * @returns {boolean} `true` if the point is contained within geometry.
   */
  containsPoint(point) {
    if (!this.bounds.containsPoint(point.x, point.y))
      return false;
    const instructions = this.instructions;
    let hasHit = false;
    for (let k = 0; k < instructions.length; k++) {
      const instruction = instructions[k];
      const data = instruction.data;
      const path = data.path;
      if (!instruction.action || !path)
        continue;
      const style = data.style;
      const shapes = path.shapePath.shapePrimitives;
      for (let i = 0; i < shapes.length; i++) {
        const shape = shapes[i].shape;
        if (!style || !shape)
          continue;
        const transform = shapes[i].transform;
        const transformedPoint = transform ? transform.applyInverse(point, tmpPoint) : point;
        if (instruction.action === "fill") {
          hasHit = shape.contains(transformedPoint.x, transformedPoint.y);
        } else {
          const strokeStyle = style;
          hasHit = shape.strokeContains(transformedPoint.x, transformedPoint.y, strokeStyle.width, strokeStyle.alignment);
        }
        const holes = data.hole;
        if (holes) {
          const holeShapes = holes.shapePath?.shapePrimitives;
          if (holeShapes) {
            for (let j = 0; j < holeShapes.length; j++) {
              if (holeShapes[j].shape.contains(transformedPoint.x, transformedPoint.y)) {
                hasHit = false;
              }
            }
          }
        }
        if (hasHit) {
          return true;
        }
      }
    }
    return hasHit;
  }
  /**
   * Destroys the GraphicsData object.
   * @param options - Options parameter. A boolean will act as if all options
   *  have been set to that value
   * @example
   * context.destroy();
   * context.destroy(true);
   * context.destroy({ texture: true, textureSource: true });
   */
  destroy(options = false) {
    this._stateStack.length = 0;
    this._transform = null;
    this.emit("destroy", this);
    this.removeAllListeners();
    const destroyTexture = typeof options === "boolean" ? options : options?.texture;
    if (destroyTexture) {
      const destroyTextureSource = typeof options === "boolean" ? options : options?.textureSource;
      if (this._fillStyle.texture) {
        this._fillStyle.fill && "uid" in this._fillStyle.fill ? this._fillStyle.fill.destroy() : this._fillStyle.texture.destroy(destroyTextureSource);
      }
      if (this._strokeStyle.texture) {
        this._strokeStyle.fill && "uid" in this._strokeStyle.fill ? this._strokeStyle.fill.destroy() : this._strokeStyle.texture.destroy(destroyTextureSource);
      }
    }
    this._fillStyle = null;
    this._strokeStyle = null;
    this.instructions = null;
    this._activePath = null;
    this._bounds = null;
    this._stateStack = null;
    this.customShader = null;
    this._transform = null;
  }
};
/** The default fill style to use when none is provided. */
_GraphicsContext.defaultFillStyle = {
  /** The color to use for the fill. */
  color: 16777215,
  /** The alpha value to use for the fill. */
  alpha: 1,
  /** The texture to use for the fill. */
  texture: Texture/* Texture */.g.WHITE,
  /** The matrix to apply. */
  matrix: null,
  /** The fill pattern to use. */
  fill: null,
  /** Whether coordinates are 'global' or 'local' */
  textureSpace: "local"
};
/** The default stroke style to use when none is provided. */
_GraphicsContext.defaultStrokeStyle = {
  /** The width of the stroke. */
  width: 1,
  /** The color to use for the stroke. */
  color: 16777215,
  /** The alpha value to use for the stroke. */
  alpha: 1,
  /** The alignment of the stroke. */
  alignment: 0.5,
  /** The miter limit to use. */
  miterLimit: 10,
  /** The line cap style to use. */
  cap: "butt",
  /** The line join style to use. */
  join: "miter",
  /** The texture to use for the fill. */
  texture: Texture/* Texture */.g.WHITE,
  /** The matrix to apply. */
  matrix: null,
  /** The fill pattern to use. */
  fill: null,
  /** Whether coordinates are 'global' or 'local' */
  textureSpace: "local",
  /** If the stroke is a pixel line. */
  pixelLine: false
};
let GraphicsContext = _GraphicsContext;


//# sourceMappingURL=GraphicsContext.mjs.map


/***/ },

/***/ 5659
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  GH: () => (/* binding */ GraphicsContextSystem)
});

// UNUSED EXPORTS: GpuGraphicsContext, GraphicsContextRenderData

// EXTERNAL MODULE: ./node_modules/pixi.js/lib/extensions/Extensions.mjs
var Extensions = __webpack_require__(8507);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/gpu/shader/BindGroup.mjs
var BindGroup = __webpack_require__(3513);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/texture/Texture.mjs + 2 modules
var Texture = __webpack_require__(226);
;// ./node_modules/pixi.js/lib/rendering/batcher/gpu/getTextureBatchBindGroup.mjs



"use strict";
const cachedGroups = {};
function getTextureBatchBindGroup(textures, size, maxTextures) {
  let uid = 2166136261;
  for (let i = 0; i < size; i++) {
    uid ^= textures[i].uid;
    uid = Math.imul(uid, 16777619);
    uid >>>= 0;
  }
  return cachedGroups[uid] || generateTextureBatchBindGroup(textures, size, uid, maxTextures);
}
function generateTextureBatchBindGroup(textures, size, key, maxTextures) {
  const bindGroupResources = {};
  let bindIndex = 0;
  for (let i = 0; i < maxTextures; i++) {
    const texture = i < size ? textures[i] : Texture/* Texture */.g.EMPTY.source;
    bindGroupResources[bindIndex++] = texture.source;
    bindGroupResources[bindIndex++] = texture.style;
  }
  const bindGroup = new BindGroup/* BindGroup */.T(bindGroupResources);
  cachedGroups[key] = bindGroup;
  return bindGroup;
}


//# sourceMappingURL=getTextureBatchBindGroup.mjs.map

// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/batcher/shared/DefaultBatcher.mjs + 6 modules
var DefaultBatcher = __webpack_require__(1331);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/instructions/InstructionSet.mjs
var InstructionSet = __webpack_require__(848);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/utils/logging/deprecation.mjs
var deprecation = __webpack_require__(4670);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/utils/pool/PoolGroup.mjs + 1 modules
var PoolGroup = __webpack_require__(1822);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/maths/matrix/Matrix.mjs
var Matrix = __webpack_require__(9313);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/maths/shapes/Rectangle.mjs
var Rectangle = __webpack_require__(9252);
;// ./node_modules/pixi.js/lib/rendering/renderers/shared/geometry/utils/buildUvs.mjs

function buildUvs(vertices, verticesStride, verticesOffset, uvs, uvsOffset, uvsStride, size, matrix = null) {
  let index = 0;
  verticesOffset *= verticesStride;
  uvsOffset *= uvsStride;
  const a = matrix.a;
  const b = matrix.b;
  const c = matrix.c;
  const d = matrix.d;
  const tx = matrix.tx;
  const ty = matrix.ty;
  while (index < size) {
    const x = vertices[verticesOffset];
    const y = vertices[verticesOffset + 1];
    uvs[uvsOffset] = a * x + c * y + tx;
    uvs[uvsOffset + 1] = b * x + d * y + ty;
    uvsOffset += uvsStride;
    verticesOffset += verticesStride;
    index++;
  }
}
function buildSimpleUvs(uvs, uvsOffset, uvsStride, size) {
  let index = 0;
  uvsOffset *= uvsStride;
  while (index < size) {
    uvs[uvsOffset] = 0;
    uvs[uvsOffset + 1] = 0;
    uvsOffset += uvsStride;
    index++;
  }
}


//# sourceMappingURL=buildUvs.mjs.map

;// ./node_modules/pixi.js/lib/rendering/renderers/shared/geometry/utils/transformVertices.mjs

function transformVertices(vertices, m, offset, stride, size) {
  const a = m.a;
  const b = m.b;
  const c = m.c;
  const d = m.d;
  const tx = m.tx;
  const ty = m.ty;
  offset || (offset = 0);
  stride || (stride = 2);
  size || (size = vertices.length / stride - offset);
  let index = offset * stride;
  for (let i = 0; i < size; i++) {
    const x = vertices[index];
    const y = vertices[index + 1];
    vertices[index] = a * x + c * y + tx;
    vertices[index + 1] = b * x + d * y + ty;
    index += stride;
  }
}


//# sourceMappingURL=transformVertices.mjs.map

// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/graphics/shared/BatchableGraphics.mjs
var BatchableGraphics = __webpack_require__(6954);
;// ./node_modules/pixi.js/lib/scene/graphics/shared/buildCommands/buildCircle.mjs


"use strict";
const buildCircle = {
  extension: {
    type: Extensions/* ExtensionType */.Ag.ShapeBuilder,
    name: "circle"
  },
  build(shape, points) {
    let x;
    let y;
    let dx;
    let dy;
    let rx;
    let ry;
    if (shape.type === "circle") {
      const circle = shape;
      rx = ry = circle.radius;
      if (rx <= 0) {
        return false;
      }
      x = circle.x;
      y = circle.y;
      dx = dy = 0;
    } else if (shape.type === "ellipse") {
      const ellipse = shape;
      rx = ellipse.halfWidth;
      ry = ellipse.halfHeight;
      if (rx <= 0 || ry <= 0) {
        return false;
      }
      x = ellipse.x;
      y = ellipse.y;
      dx = dy = 0;
    } else {
      const roundedRect = shape;
      const halfWidth = roundedRect.width / 2;
      const halfHeight = roundedRect.height / 2;
      x = roundedRect.x + halfWidth;
      y = roundedRect.y + halfHeight;
      rx = ry = Math.max(0, Math.min(roundedRect.radius, Math.min(halfWidth, halfHeight)));
      dx = halfWidth - rx;
      dy = halfHeight - ry;
    }
    if (dx < 0 || dy < 0) {
      return false;
    }
    const n = Math.ceil(2.3 * Math.sqrt(rx + ry));
    const m = n * 8 + (dx ? 4 : 0) + (dy ? 4 : 0);
    if (m === 0) {
      return false;
    }
    if (n === 0) {
      points[0] = points[6] = x + dx;
      points[1] = points[3] = y + dy;
      points[2] = points[4] = x - dx;
      points[5] = points[7] = y - dy;
      return true;
    }
    let j1 = 0;
    let j2 = n * 4 + (dx ? 2 : 0) + 2;
    let j3 = j2;
    let j4 = m;
    let x0 = dx + rx;
    let y0 = dy;
    let x1 = x + x0;
    let x2 = x - x0;
    let y1 = y + y0;
    points[j1++] = x1;
    points[j1++] = y1;
    points[--j2] = y1;
    points[--j2] = x2;
    if (dy) {
      const y22 = y - y0;
      points[j3++] = x2;
      points[j3++] = y22;
      points[--j4] = y22;
      points[--j4] = x1;
    }
    for (let i = 1; i < n; i++) {
      const a = Math.PI / 2 * (i / n);
      const x02 = dx + Math.cos(a) * rx;
      const y02 = dy + Math.sin(a) * ry;
      const x12 = x + x02;
      const x22 = x - x02;
      const y12 = y + y02;
      const y22 = y - y02;
      points[j1++] = x12;
      points[j1++] = y12;
      points[--j2] = y12;
      points[--j2] = x22;
      points[j3++] = x22;
      points[j3++] = y22;
      points[--j4] = y22;
      points[--j4] = x12;
    }
    x0 = dx;
    y0 = dy + ry;
    x1 = x + x0;
    x2 = x - x0;
    y1 = y + y0;
    const y2 = y - y0;
    points[j1++] = x1;
    points[j1++] = y1;
    points[--j4] = y2;
    points[--j4] = x1;
    if (dx) {
      points[j1++] = x2;
      points[j1++] = y1;
      points[--j4] = y2;
      points[--j4] = x2;
    }
    return true;
  },
  triangulate(points, vertices, verticesStride, verticesOffset, indices, indicesOffset) {
    if (points.length === 0) {
      return;
    }
    let centerX = 0;
    let centerY = 0;
    for (let i = 0; i < points.length; i += 2) {
      centerX += points[i];
      centerY += points[i + 1];
    }
    centerX /= points.length / 2;
    centerY /= points.length / 2;
    let count = verticesOffset;
    vertices[count * verticesStride] = centerX;
    vertices[count * verticesStride + 1] = centerY;
    const centerIndex = count++;
    for (let i = 0; i < points.length; i += 2) {
      vertices[count * verticesStride] = points[i];
      vertices[count * verticesStride + 1] = points[i + 1];
      if (i > 0) {
        indices[indicesOffset++] = count;
        indices[indicesOffset++] = centerIndex;
        indices[indicesOffset++] = count - 1;
      }
      count++;
    }
    indices[indicesOffset++] = centerIndex + 1;
    indices[indicesOffset++] = centerIndex;
    indices[indicesOffset++] = count - 1;
  }
};
const buildEllipse = { ...buildCircle, extension: { ...buildCircle.extension, name: "ellipse" } };
const buildRoundedRectangle = { ...buildCircle, extension: { ...buildCircle.extension, name: "roundedRectangle" } };


//# sourceMappingURL=buildCircle.mjs.map

// EXTERNAL MODULE: ./node_modules/pixi.js/lib/maths/point/Point.mjs
var Point = __webpack_require__(5101);
;// ./node_modules/pixi.js/lib/scene/graphics/shared/const.mjs

const closePointEps = 1e-4;
const curveEps = 1e-4;


//# sourceMappingURL=const.mjs.map

;// ./node_modules/pixi.js/lib/scene/graphics/shared/utils/getOrientationOfPoints.mjs

function getOrientationOfPoints(points) {
  const m = points.length;
  if (m < 6) {
    return 1;
  }
  let area = 0;
  for (let i = 0, x1 = points[m - 2], y1 = points[m - 1]; i < m; i += 2) {
    const x2 = points[i];
    const y2 = points[i + 1];
    area += (x2 - x1) * (y2 + y1);
    x1 = x2;
    y1 = y2;
  }
  if (area < 0) {
    return -1;
  }
  return 1;
}


//# sourceMappingURL=getOrientationOfPoints.mjs.map

;// ./node_modules/pixi.js/lib/scene/graphics/shared/buildCommands/buildLine.mjs




"use strict";
function square(x, y, nx, ny, innerWeight, outerWeight, clockwise, verts) {
  const ix = x - nx * innerWeight;
  const iy = y - ny * innerWeight;
  const ox = x + nx * outerWeight;
  const oy = y + ny * outerWeight;
  let exx;
  let eyy;
  if (clockwise) {
    exx = ny;
    eyy = -nx;
  } else {
    exx = -ny;
    eyy = nx;
  }
  const eix = ix + exx;
  const eiy = iy + eyy;
  const eox = ox + exx;
  const eoy = oy + eyy;
  verts.push(eix, eiy);
  verts.push(eox, eoy);
  return 2;
}
function round(cx, cy, sx, sy, ex, ey, verts, clockwise) {
  const cx2p0x = sx - cx;
  const cy2p0y = sy - cy;
  let angle0 = Math.atan2(cx2p0x, cy2p0y);
  let angle1 = Math.atan2(ex - cx, ey - cy);
  if (clockwise && angle0 < angle1) {
    angle0 += Math.PI * 2;
  } else if (!clockwise && angle0 > angle1) {
    angle1 += Math.PI * 2;
  }
  let startAngle = angle0;
  const angleDiff = angle1 - angle0;
  const absAngleDiff = Math.abs(angleDiff);
  const radius = Math.sqrt(cx2p0x * cx2p0x + cy2p0y * cy2p0y);
  const segCount = (15 * absAngleDiff * Math.sqrt(radius) / Math.PI >> 0) + 1;
  const angleInc = angleDiff / segCount;
  startAngle += angleInc;
  if (clockwise) {
    verts.push(cx, cy);
    verts.push(sx, sy);
    for (let i = 1, angle = startAngle; i < segCount; i++, angle += angleInc) {
      verts.push(cx, cy);
      verts.push(
        cx + Math.sin(angle) * radius,
        cy + Math.cos(angle) * radius
      );
    }
    verts.push(cx, cy);
    verts.push(ex, ey);
  } else {
    verts.push(sx, sy);
    verts.push(cx, cy);
    for (let i = 1, angle = startAngle; i < segCount; i++, angle += angleInc) {
      verts.push(
        cx + Math.sin(angle) * radius,
        cy + Math.cos(angle) * radius
      );
      verts.push(cx, cy);
    }
    verts.push(ex, ey);
    verts.push(cx, cy);
  }
  return segCount * 2;
}
function buildLine(points, lineStyle, flipAlignment, closed, vertices, indices) {
  const eps = closePointEps;
  if (points.length === 0) {
    return;
  }
  const style = lineStyle;
  let alignment = style.alignment;
  if (lineStyle.alignment !== 0.5) {
    let orientation = getOrientationOfPoints(points);
    if (flipAlignment)
      orientation *= -1;
    alignment = (alignment - 0.5) * orientation + 0.5;
  }
  const firstPoint = new Point/* Point */.b(points[0], points[1]);
  const lastPoint = new Point/* Point */.b(points[points.length - 2], points[points.length - 1]);
  const closedShape = closed;
  const closedPath = Math.abs(firstPoint.x - lastPoint.x) < eps && Math.abs(firstPoint.y - lastPoint.y) < eps;
  if (closedShape) {
    points = points.slice();
    if (closedPath) {
      points.pop();
      points.pop();
      lastPoint.set(points[points.length - 2], points[points.length - 1]);
    }
    const midPointX = (firstPoint.x + lastPoint.x) * 0.5;
    const midPointY = (lastPoint.y + firstPoint.y) * 0.5;
    points.unshift(midPointX, midPointY);
    points.push(midPointX, midPointY);
  }
  const verts = vertices;
  const length = points.length / 2;
  let indexCount = points.length;
  const indexStart = verts.length / 2;
  const width = style.width / 2;
  const widthSquared = width * width;
  const miterLimitSquared = style.miterLimit * style.miterLimit;
  let x0 = points[0];
  let y0 = points[1];
  let x1 = points[2];
  let y1 = points[3];
  let x2 = 0;
  let y2 = 0;
  let perpX = -(y0 - y1);
  let perpY = x0 - x1;
  let perp1x = 0;
  let perp1y = 0;
  let dist = Math.sqrt(perpX * perpX + perpY * perpY);
  perpX /= dist;
  perpY /= dist;
  perpX *= width;
  perpY *= width;
  const ratio = alignment;
  const innerWeight = (1 - ratio) * 2;
  const outerWeight = ratio * 2;
  if (!closedShape) {
    if (style.cap === "round") {
      indexCount += round(
        x0 - perpX * (innerWeight - outerWeight) * 0.5,
        y0 - perpY * (innerWeight - outerWeight) * 0.5,
        x0 - perpX * innerWeight,
        y0 - perpY * innerWeight,
        x0 + perpX * outerWeight,
        y0 + perpY * outerWeight,
        verts,
        true
      ) + 2;
    } else if (style.cap === "square") {
      indexCount += square(x0, y0, perpX, perpY, innerWeight, outerWeight, true, verts);
    }
  }
  verts.push(
    x0 - perpX * innerWeight,
    y0 - perpY * innerWeight
  );
  verts.push(
    x0 + perpX * outerWeight,
    y0 + perpY * outerWeight
  );
  for (let i = 1; i < length - 1; ++i) {
    x0 = points[(i - 1) * 2];
    y0 = points[(i - 1) * 2 + 1];
    x1 = points[i * 2];
    y1 = points[i * 2 + 1];
    x2 = points[(i + 1) * 2];
    y2 = points[(i + 1) * 2 + 1];
    perpX = -(y0 - y1);
    perpY = x0 - x1;
    dist = Math.sqrt(perpX * perpX + perpY * perpY);
    perpX /= dist;
    perpY /= dist;
    perpX *= width;
    perpY *= width;
    perp1x = -(y1 - y2);
    perp1y = x1 - x2;
    dist = Math.sqrt(perp1x * perp1x + perp1y * perp1y);
    perp1x /= dist;
    perp1y /= dist;
    perp1x *= width;
    perp1y *= width;
    const dx0 = x1 - x0;
    const dy0 = y0 - y1;
    const dx1 = x1 - x2;
    const dy1 = y2 - y1;
    const dot = dx0 * dx1 + dy0 * dy1;
    const cross = dy0 * dx1 - dy1 * dx0;
    const clockwise = cross < 0;
    if (Math.abs(cross) < 1e-3 * Math.abs(dot)) {
      verts.push(
        x1 - perpX * innerWeight,
        y1 - perpY * innerWeight
      );
      verts.push(
        x1 + perpX * outerWeight,
        y1 + perpY * outerWeight
      );
      if (dot >= 0) {
        if (style.join === "round") {
          indexCount += round(
            x1,
            y1,
            x1 - perpX * innerWeight,
            y1 - perpY * innerWeight,
            x1 - perp1x * innerWeight,
            y1 - perp1y * innerWeight,
            verts,
            false
          ) + 4;
        } else {
          indexCount += 2;
        }
        verts.push(
          x1 - perp1x * outerWeight,
          y1 - perp1y * outerWeight
        );
        verts.push(
          x1 + perp1x * innerWeight,
          y1 + perp1y * innerWeight
        );
      }
      continue;
    }
    const c1 = (-perpX + x0) * (-perpY + y1) - (-perpX + x1) * (-perpY + y0);
    const c2 = (-perp1x + x2) * (-perp1y + y1) - (-perp1x + x1) * (-perp1y + y2);
    const px = (dx0 * c2 - dx1 * c1) / cross;
    const py = (dy1 * c1 - dy0 * c2) / cross;
    const pDist = (px - x1) * (px - x1) + (py - y1) * (py - y1);
    const imx = x1 + (px - x1) * innerWeight;
    const imy = y1 + (py - y1) * innerWeight;
    const omx = x1 - (px - x1) * outerWeight;
    const omy = y1 - (py - y1) * outerWeight;
    const smallerInsideSegmentSq = Math.min(dx0 * dx0 + dy0 * dy0, dx1 * dx1 + dy1 * dy1);
    const insideWeight = clockwise ? innerWeight : outerWeight;
    const smallerInsideDiagonalSq = smallerInsideSegmentSq + insideWeight * insideWeight * widthSquared;
    const insideMiterOk = pDist <= smallerInsideDiagonalSq;
    if (insideMiterOk) {
      if (style.join === "bevel" || pDist / widthSquared > miterLimitSquared) {
        if (clockwise) {
          verts.push(imx, imy);
          verts.push(x1 + perpX * outerWeight, y1 + perpY * outerWeight);
          verts.push(imx, imy);
          verts.push(x1 + perp1x * outerWeight, y1 + perp1y * outerWeight);
        } else {
          verts.push(x1 - perpX * innerWeight, y1 - perpY * innerWeight);
          verts.push(omx, omy);
          verts.push(x1 - perp1x * innerWeight, y1 - perp1y * innerWeight);
          verts.push(omx, omy);
        }
        indexCount += 2;
      } else if (style.join === "round") {
        if (clockwise) {
          verts.push(imx, imy);
          verts.push(x1 + perpX * outerWeight, y1 + perpY * outerWeight);
          indexCount += round(
            x1,
            y1,
            x1 + perpX * outerWeight,
            y1 + perpY * outerWeight,
            x1 + perp1x * outerWeight,
            y1 + perp1y * outerWeight,
            verts,
            true
          ) + 4;
          verts.push(imx, imy);
          verts.push(x1 + perp1x * outerWeight, y1 + perp1y * outerWeight);
        } else {
          verts.push(x1 - perpX * innerWeight, y1 - perpY * innerWeight);
          verts.push(omx, omy);
          indexCount += round(
            x1,
            y1,
            x1 - perpX * innerWeight,
            y1 - perpY * innerWeight,
            x1 - perp1x * innerWeight,
            y1 - perp1y * innerWeight,
            verts,
            false
          ) + 4;
          verts.push(x1 - perp1x * innerWeight, y1 - perp1y * innerWeight);
          verts.push(omx, omy);
        }
      } else {
        verts.push(imx, imy);
        verts.push(omx, omy);
      }
    } else {
      verts.push(x1 - perpX * innerWeight, y1 - perpY * innerWeight);
      verts.push(x1 + perpX * outerWeight, y1 + perpY * outerWeight);
      if (style.join === "round") {
        if (clockwise) {
          indexCount += round(
            x1,
            y1,
            x1 + perpX * outerWeight,
            y1 + perpY * outerWeight,
            x1 + perp1x * outerWeight,
            y1 + perp1y * outerWeight,
            verts,
            true
          ) + 2;
        } else {
          indexCount += round(
            x1,
            y1,
            x1 - perpX * innerWeight,
            y1 - perpY * innerWeight,
            x1 - perp1x * innerWeight,
            y1 - perp1y * innerWeight,
            verts,
            false
          ) + 2;
        }
      } else if (style.join === "miter" && pDist / widthSquared <= miterLimitSquared) {
        if (clockwise) {
          verts.push(omx, omy);
          verts.push(omx, omy);
        } else {
          verts.push(imx, imy);
          verts.push(imx, imy);
        }
        indexCount += 2;
      }
      verts.push(x1 - perp1x * innerWeight, y1 - perp1y * innerWeight);
      verts.push(x1 + perp1x * outerWeight, y1 + perp1y * outerWeight);
      indexCount += 2;
    }
  }
  x0 = points[(length - 2) * 2];
  y0 = points[(length - 2) * 2 + 1];
  x1 = points[(length - 1) * 2];
  y1 = points[(length - 1) * 2 + 1];
  perpX = -(y0 - y1);
  perpY = x0 - x1;
  dist = Math.sqrt(perpX * perpX + perpY * perpY);
  perpX /= dist;
  perpY /= dist;
  perpX *= width;
  perpY *= width;
  verts.push(x1 - perpX * innerWeight, y1 - perpY * innerWeight);
  verts.push(x1 + perpX * outerWeight, y1 + perpY * outerWeight);
  if (!closedShape) {
    if (style.cap === "round") {
      indexCount += round(
        x1 - perpX * (innerWeight - outerWeight) * 0.5,
        y1 - perpY * (innerWeight - outerWeight) * 0.5,
        x1 - perpX * innerWeight,
        y1 - perpY * innerWeight,
        x1 + perpX * outerWeight,
        y1 + perpY * outerWeight,
        verts,
        false
      ) + 2;
    } else if (style.cap === "square") {
      indexCount += square(x1, y1, perpX, perpY, innerWeight, outerWeight, false, verts);
    }
  }
  const eps2 = curveEps * curveEps;
  for (let i = indexStart; i < indexCount + indexStart - 2; ++i) {
    x0 = verts[i * 2];
    y0 = verts[i * 2 + 1];
    x1 = verts[(i + 1) * 2];
    y1 = verts[(i + 1) * 2 + 1];
    x2 = verts[(i + 2) * 2];
    y2 = verts[(i + 2) * 2 + 1];
    if (Math.abs(x0 * (y1 - y2) + x1 * (y2 - y0) + x2 * (y0 - y1)) < eps2) {
      continue;
    }
    indices.push(i, i + 1, i + 2);
  }
}


//# sourceMappingURL=buildLine.mjs.map

;// ./node_modules/pixi.js/lib/scene/graphics/shared/buildCommands/buildPixelLine.mjs


"use strict";
function buildPixelLine(points, closed, vertices, indices) {
  const eps = closePointEps;
  if (points.length === 0) {
    return;
  }
  const fx = points[0];
  const fy = points[1];
  const lx = points[points.length - 2];
  const ly = points[points.length - 1];
  const closePath = closed || Math.abs(fx - lx) < eps && Math.abs(fy - ly) < eps;
  const verts = vertices;
  const length = points.length / 2;
  const indexStart = verts.length / 2;
  for (let i = 0; i < length; i++) {
    verts.push(points[i * 2]);
    verts.push(points[i * 2 + 1]);
  }
  for (let i = 0; i < length - 1; i++) {
    indices.push(indexStart + i, indexStart + i + 1);
  }
  if (closePath) {
    indices.push(indexStart + length - 1, indexStart);
  }
}


//# sourceMappingURL=buildPixelLine.mjs.map

;// ./node_modules/earcut/src/earcut.js
/**
 * A vertex in a circular doubly linked list representing a polygon ring.
 * `prev`/`next` are always linked (set immediately after {@link createNode}), so they're typed
 * non-null; `prevZ`/`nextZ` are the z-order list links and are null at the ends.
 *
 * @typedef {object} Node
 * @property {number} i vertex index in the coordinates array
 * @property {number} x vertex x coordinate
 * @property {number} y vertex y coordinate
 * @property {Node} prev previous vertex node in the polygon ring
 * @property {Node} next next vertex node in the polygon ring
 * @property {number} z z-order curve value; doubles as the owning block index during eliminateHoles
 * @property {Node | null} prevZ previous node in z-order
 * @property {Node | null} nextZ next node in z-order
 */

// single-vertex holes to preserve through filterPoints (steiner points); kept off the Node
// shape since they're rare — the empty-set fast path means non-steiner inputs pay nothing
/** @type {Set<Node>} */
const steiners = new Set();

// set by filterPoints whenever it removes at least one node; read by earcutLinked's stall
// handler to decide whether another clip pass is worth attempting before the costlier stages
let filteredOut = false;

/**
 * Triangulate a polygon given as a flat array of vertex coordinates.
 *
 * @param {ArrayLike<number>} data flat array of vertex coordinates
 * @param {ArrayLike<number> | null} [holeIndices] indices (in vertices, not coordinates) where each hole ring starts
 * @param {number} [dim=2] number of coordinates per vertex in `data`
 * @returns {number[]} triangles as triplets of vertex indices into `data`
 * @example earcut([10,0, 0,50, 60,60, 70,10]); // [1,0,3, 3,2,1]
 */
function earcut(data, holeIndices, dim = 2) {

    const hasHoles = holeIndices && holeIndices.length;
    const outerLen = hasHoles ? holeIndices[0] * dim : data.length;
    if (steiners.size) steiners.clear();

    let outerNode = linkedList(data, 0, outerLen, dim, true);
    /** @type {number[]} */
    const triangles = [];

    if (!outerNode || outerNode.next === outerNode.prev) return triangles;

    let minX = 0, minY = 0, invSize = 0;

    if (hasHoles) outerNode = eliminateHoles(data, holeIndices, outerNode, dim);

    // if the shape is not too simple, we'll use z-order curve hash later; calculate polygon bbox
    if (data.length > 80 * dim) {
        minX = data[0];
        minY = data[1];
        let maxX = minX;
        let maxY = minY;

        for (let i = dim; i < outerLen; i += dim) {
            const x = data[i];
            const y = data[i + 1];
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        }

        // minX, minY and invSize are later used to transform coords into integers for z-order calculation
        invSize = Math.max(maxX - minX, maxY - minY);
        invSize = invSize !== 0 ? 32767 / invSize : 0;
    }

    earcutLinked(outerNode, triangles, minX, minY, invSize);

    return triangles;
}

// create a circular doubly linked list from polygon points in the specified winding order
/** @param {ArrayLike<number>} data @param {number} start @param {number} end @param {number} dim @param {boolean} clockwise @returns {Node | null} */
function linkedList(data, start, end, dim, clockwise) {
    /** @type {Node | null} */
    let last = null;

    if (clockwise === (signedArea(data, start, end, dim) > 0)) {
        for (let i = start; i < end; i += dim) last = insertNode(i / dim | 0, data[i], data[i + 1], last);
    } else {
        for (let i = end - dim; i >= start; i -= dim) last = insertNode(i / dim | 0, data[i], data[i + 1], last);
    }

    if (last && equals(last, last.next)) {
        removeNode(last);
        last = last.next;
    }

    return last;
}

// Remove collinear or coincident points; removability depends only on a node's immediate
// neighbors, so we sweep forward and re-check the predecessor after each removal. With no `end`
// we sweep the whole ring, lapping until nothing is removable (the fixpoint the clipper needs).
// With an explicit `end` we heal only the dirty window around a bridge/diagonal cut, stopping at
// `end` rather than lapping — O(window) instead of O(ring).
/** @param {Node} start @param {Node} [end] @returns {Node} */
function filterPoints(start, end = start) {
    const full = end === start;

    let p = start, again;
    do {
        again = false;
        if (p !== p.next && (steiners.size === 0 || !steiners.has(p)) &&
            (equals(p, p.next) || earcut_area(p.prev, p, p.next) === 0)) {
            if (full || p === end) end = p.prev; // pull the stop bound back past the removal
            filteredOut = true;
            removeNode(p);
            p = p.prev;         // re-check the predecessor
            again = true;
        } else if (full || p !== end) {
            p = p.next;
            again = !full;      // local heal: keep looping until the sweep reaches end
        }
    } while (again || p !== end);

    return end;
}

// main ear slicing loop which triangulates a polygon (given as a linked list)
/** @param {Node} ear @param {number[]} triangles @param {number} minX @param {number} minY @param {number} invSize */
function earcutLinked(ear, triangles, minX, minY, invSize) {
    // interlink polygon nodes in z-order
    if (invSize) indexCurve(ear, minX, minY, invSize);

    let stop = ear, cured = false;

    // iterate through ears, slicing them one by one
    while (ear.prev !== ear.next) {
        const prev = ear.prev;
        /** @type {Node} */
        const next = ear.next;

        if (earcut_area(prev, ear, next) < 0 && (invSize ? isEarHashed(ear, minX, minY, invSize) : isEar(ear))) {
            triangles.push(prev.i, ear.i, next.i); // cut off the triangle

            removeNode(ear);
            ear = next;
            stop = next;
            continue;
        }

        ear = next;

        // if we looped through the whole remaining polygon and can't find any more ears
        if (ear === stop) {
            // try filtering collinear/coincident points and slicing again — repeat as long as
            // filtering actually removes nodes, since each removal can expose new ears
            filteredOut = false;
            ear = filterPoints(ear);
            if (filteredOut) { stop = ear; continue; }

            // filtering is exhausted: cure small local self-intersections once, then retry
            if (!cured) {
                ear = cureLocalIntersections(ear, triangles);
                stop = ear;
                cured = true;
                continue;
            }

            // as a last resort, try splitting the remaining polygon into two
            splitEarcut(ear, triangles, minX, minY, invSize);
            break;
        }
    }
}

// check whether a polygon node forms a valid ear with adjacent nodes
/** @param {Node} ear @returns {boolean} */
function isEar(ear) {
    // reflex check (area(a, b, c) >= 0) is hoisted into the earcutLinked caller to avoid non-inlined call here
    const a = ear.prev, b = ear, c = ear.next,
        ax = a.x, bx = b.x, cx = c.x, ay = a.y, by = b.y, cy = c.y,
        x0 = Math.min(ax, bx, cx), // triangle bbox
        y0 = Math.min(ay, by, cy),
        x1 = Math.max(ax, bx, cx),
        y1 = Math.max(ay, by, cy);

    // make sure we don't have other points inside the potential ear
    let p = c.next;
    while (p !== a) {
        if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && !(ax === p.x && ay === p.y) &&
            pointInTriangle(ax, ay, bx, by, cx, cy, p.x, p.y) && earcut_area(p.prev, p, p.next) >= 0) return false;
        p = p.next;
    }
    return true;
}

/** @param {Node} ear @param {number} minX @param {number} minY @param {number} invSize @returns {boolean} */
function isEarHashed(ear, minX, minY, invSize) {
    // reflex check is hoisted into the earcutLinked caller (see isEar)
    const a = ear.prev, b = ear, c = ear.next,
        ax = a.x, bx = b.x, cx = c.x, ay = a.y, by = b.y, cy = c.y,
        x0 = Math.min(ax, bx, cx), // triangle bbox
        y0 = Math.min(ay, by, cy),
        x1 = Math.max(ax, bx, cx),
        y1 = Math.max(ay, by, cy),
        minZ = zOrder(x0, y0, minX, minY, invSize), // z-order range for the current triangle bbox;
        maxZ = zOrder(x1, y1, minX, minY, invSize);

    let p = ear.prevZ;
    while (p && p.z >= minZ) { // look for points inside the triangle in decreasing z-order
        if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && p !== c && !(ax === p.x && ay === p.y) &&
            pointInTriangle(ax, ay, bx, by, cx, cy, p.x, p.y) && earcut_area(p.prev, p, p.next) >= 0) return false;
        p = p.prevZ;
    }
    let n = ear.nextZ;
    while (n && n.z <= maxZ) { // look for points in increasing z-order
        if (n.x >= x0 && n.x <= x1 && n.y >= y0 && n.y <= y1 && n !== c && !(ax === n.x && ay === n.y) &&
            pointInTriangle(ax, ay, bx, by, cx, cy, n.x, n.y) && earcut_area(n.prev, n, n.next) >= 0) return false;
        n = n.nextZ;
    }
    return true;
}

// go through all polygon nodes and cure small local self-intersections
/** @param {Node} start @param {number[]} triangles @returns {Node} */
function cureLocalIntersections(start, triangles) {
    let p = start;
    let cured = false;
    do {
        const a = p.prev,
            b = p.next.next;

        if (intersects(a, p, p.next, b, false) && locallyInside(a, b) && locallyInside(b, a)) {

            triangles.push(a.i, p.i, b.i);

            // remove two nodes involved
            removeNode(p);
            removeNode(p.next);

            p = start = b;
            cured = true;
        }
        p = p.next;
    } while (p !== start);

    return cured ? filterPoints(p) : p;
}

// try splitting polygon into two and triangulate them independently
/** @param {Node} start @param {number[]} triangles @param {number} minX @param {number} minY @param {number} invSize */
function splitEarcut(start, triangles, minX, minY, invSize) {
    // look for a valid diagonal that divides the polygon into two
    let a = start;
    do {
        let b = a.next.next;
        while (b !== a.prev) {
            if (a.i !== b.i && isValidDiagonal(a, b)) {
                // split the polygon in two by the diagonal
                let c = splitPolygon(a, b);

                // filter colinear points around the cuts
                a = filterPoints(a, a.next);
                c = filterPoints(c, c.next);

                // run earcut on each half
                earcutLinked(a, triangles, minX, minY, invSize);
                earcutLinked(c, triangles, minX, minY, invSize);
                return;
            }
            b = b.next;
        }
        a = a.next;
    } while (a !== start);
}

// true only while eliminateHoles merges holes, so removeNode keeps the block index live (growBlock)
let indexActive = false;

// link every hole into the outer loop, producing a single-ring polygon without holes
/** @param {ArrayLike<number>} data @param {ArrayLike<number>} holeIndices @param {Node} outerNode @param {number} dim @returns {Node} */
function eliminateHoles(data, holeIndices, outerNode, dim) {
    const queue = [];

    for (let i = 0, len = holeIndices.length; i < len; i++) {
        const start = holeIndices[i] * dim;
        const end = i < len - 1 ? holeIndices[i + 1] * dim : data.length;
        const list = /** @type {Node} */ (linkedList(data, start, end, dim, false));
        if (list === list.next) steiners.add(list);
        queue.push(getLeftmost(list));
    }

    queue.sort(compareXYSlope);

    // block-bbox index for findHoleBridge, grown append-only as holes merge (see notes
    // above buildBlockIndex). Seed it with the outer ring, then append each merged hole.
    buildBlockIndex(data.length / dim, holeIndices.length);
    indexSegment(outerNode, outerNode);

    // process holes from left to right; indexActive lets removeNode keep block bboxes live as
    // filterPoints heals edges during merges (see growBlock)
    indexActive = true;
    for (let i = 0; i < queue.length; i++) {
        outerNode = eliminateHole(queue[i], outerNode);
    }
    indexActive = false;

    // collapse collinear/coincident points across the whole merged ring once before clipping
    return filterPoints(outerNode);
}

/** @param {Node} a @param {Node} b @returns {number} */
function compareXYSlope(a, b) {
    // when the left-most point of 2 holes meet at a vertex, sort the holes counterclockwise so that when we find
    // the bridge to the outer shell is always the point that they meet at.
    return a.x - b.x || a.y - b.y ||
        (a.next.y - a.y) / (a.next.x - a.x) -
        (b.next.y - b.y) / (b.next.x - b.x);
}

// find a bridge between vertices that connects hole with an outer ring and link it
/** @param {Node} hole @param {Node} outerNode @returns {Node} */
function eliminateHole(hole, outerNode) {
    const bridge = findHoleBridge(hole, outerNode);
    if (!bridge) {
        return outerNode;
    }

    const bridgeReverse = splitPolygon(bridge, hole);

    // index the merged-in segment before filtering: in ring order the splice runs
    // bridge -> hole -> bridgeReverse -> bridge2 -> (bridge's old next), covering the
    // hole's edges and both new slit edges. filterPoints below only drops collinear /
    // coincident points, so these bboxes stay valid (conservative) supersets.
    const bridge2 = bridgeReverse.next;
    indexSegment(bridge, bridge2.next);

    // heal collinear/coincident points around the two new slit edges
    filterPoints(bridgeReverse, bridgeReverse.next);
    return filterPoints(bridge, bridge.next);
}

// Block-bbox index for findHoleBridge (issue #183): one [minX,minY,maxX,maxY] bbox per K
// consecutive ring edges, in a flat Float64Array, so the leftward-ray scan can skip whole
// blocks in O(1) instead of walking the entire merged ring. Grown append-only — the outer
// ring seeds it, then each merged hole appends a segment (head node, stop node, K-blocks
// over head..stop); independent segments, not a ring tiling, since splices land mid-ring.
// Buffers are sized once from the input upper bound and reused across calls.
//
// filterPoints only drops collinear/coincident points, so a stale bbox stays a conservative
// superset of its live edges (never a false skip); the scan skips dead nodes (p.prev.next !==
// p) and lazily advances a dead stop. Blocks are scanned in append (not ring) order, so the
// chosen bridge can differ from the un-indexed code — a different but equally valid result.
const K = 16; // edges per block

let blockBBox = new Float64Array(0); // [minX,minY,maxX,maxY] per block
let numBlocks = 0;
/** @type {Node[]} */
const blockHead = []; // first node of each block's segment
/** @type {Node[]} */
const blockStop = []; // node just past each block's segment (exclusive walk bound)

/** @param {number} maxNodes @param {number} numHoles */
function buildBlockIndex(maxNodes, numHoles) {
    // upper bound: every input node indexed once, +2 bridge nodes per hole, plus a partial
    // trailing block per appended segment (outer ring + one per hole)
    const maxBlocks = Math.ceil((maxNodes + 2 * numHoles) / K) + numHoles + 2;
    if (blockBBox.length < maxBlocks * 4) blockBBox = new Float64Array(maxBlocks * 4);
    numBlocks = 0;
}

// index the ring run head..stop (exclusive) as ceil(len / K) blocks; head === stop means
// the whole ring. each block's bbox covers both endpoints of every edge it owns.
/** @param {Node} head @param {Node} stop */
function indexSegment(head, stop) {
    let p = head;
    do {
        const b = numBlocks++;
        blockHead[b] = p;
        let minX = p.x, minY = p.y, maxX = p.x, maxY = p.y;
        let k = 0;
        do {
            const c = p.next; // edge p->c; bbox must bound both endpoints
            p.z = b; // reuse z as the owning block during eliminateHoles (see growBlock)
            if (c.x < minX) minX = c.x; if (c.x > maxX) maxX = c.x;
            if (c.y < minY) minY = c.y; if (c.y > maxY) maxY = c.y;
            p = c;
        } while (++k < K && p !== stop);
        blockStop[b] = p;
        const g = b * 4;
        blockBBox[g] = minX; blockBBox[g + 1] = minY; blockBBox[g + 2] = maxX; blockBBox[g + 3] = maxY;
    } while (p !== stop);
}

// when filterPoints heals an edge head->tail (removing the collinear node between them), the
// healed edge can extend past head's frozen block bbox if its old far endpoint lived in another
// block; grow head's block bbox to cover tail so the leftward-ray prune can't false-skip it.
/** @param {Node} head @param {Node} tail */
function growBlock(head, tail) {
    const g = head.z * 4;
    if (tail.x < blockBBox[g]) blockBBox[g] = tail.x;
    if (tail.y < blockBBox[g + 1]) blockBBox[g + 1] = tail.y;
    if (tail.x > blockBBox[g + 2]) blockBBox[g + 2] = tail.x;
    if (tail.y > blockBBox[g + 3]) blockBBox[g + 3] = tail.y;
}

/** @param {number} b @returns {Node} */
function liveBlockStop(b) {
    let stop = blockStop[b];
    while (stop.prev.next !== stop) stop = stop.next;
    blockStop[b] = stop;
    return stop;
}

// the block's head node can be removed by filterPoints during merges; advance it to the next
// live node so the walk doesn't start on (and immediately terminate at) a dead node. For the
// single full-ring seed block (head === stop) the same forward advance keeps them equal, so the
// do-while still laps the whole ring instead of collapsing to an empty walk.
/** @param {number} b @returns {Node} */
function liveBlockHead(b) {
    let head = blockHead[b];
    while (head.prev.next !== head) head = head.next;
    blockHead[b] = head;
    return head;
}

// David Eberly's algorithm for finding a bridge between hole and outer polygon
/** @param {Node} hole @param {Node} outerNode @returns {Node | null} */
function findHoleBridge(hole, outerNode) {
    let p = outerNode;
    const hx = hole.x;
    const hy = hole.y;
    let qx = -Infinity;
    /** @type {Node | undefined} */
    let m;

    // find a segment intersected by a ray from the hole's leftmost point to the left;
    // segment's endpoint with lesser x will be potential connection point
    // unless they intersect at a vertex, then choose the vertex
    if (equals(hole, p)) return p;

    // scan blocks; skip any whose bbox can't hold a crossing that beats qx and lies left
    // of hx (the prune Morton order can't express — explicit per-axis [minY,maxY]/[minX,maxX])
    for (let b = 0, g = 0; b < numBlocks; b++, g += 4) {
        if (hy < blockBBox[g + 1] || hy > blockBBox[g + 3] || blockBBox[g] > hx || blockBBox[g + 2] <= qx) continue;

        // ensure the walk's exclusive bound is live so we don't overrun into other blocks
        const stop = liveBlockStop(b);

        p = liveBlockHead(b);
        do {
            if (p.prev.next === p) { // skip nodes removed by filterPoints (stale in the index)
                if (equals(hole, p.next)) return p.next;
                else if (hy <= p.y && hy >= p.next.y && p.next.y !== p.y) {
                    const x = p.x + (hy - p.y) * (p.next.x - p.x) / (p.next.y - p.y);
                    if (x <= hx && x > qx) {
                        qx = x;
                        m = p.x < p.next.x ? p : p.next;
                        if (x === hx) return m; // hole touches outer segment; pick leftmost endpoint
                    }
                }
            }
            p = p.next;
        } while (p !== stop);
    }

    if (!m) return null;

    // look for points inside the triangle of hole point, segment intersection and endpoint;
    // if there are no points found, we have a valid connection;
    // otherwise choose the point of the minimum angle with the ray as connection point

    const mx = m.x;
    const my = m.y;
    const tminY = Math.min(hy, my); // the triangle's y span; x span is [mx, hx]
    const tmaxY = Math.max(hy, my);
    let tanMin = Infinity;

    // scan the same blocks; skip any whose bbox can't overlap the triangle's [mx,hx]×[tminY,tmaxY] box
    for (let b = 0, g = 0; b < numBlocks; b++, g += 4) {
        if (blockBBox[g + 2] < mx || blockBBox[g] > hx || blockBBox[g + 3] < tminY || blockBBox[g + 1] > tmaxY) continue;

        const stop = liveBlockStop(b);

        p = liveBlockHead(b);
        do {
            if (p.prev.next === p && hx >= p.x && p.x >= mx && hx !== p.x && // skip dead nodes
                    pointInTriangle(hy < my ? hx : qx, hy, mx, my, hy < my ? qx : hx, hy, p.x, p.y)) {

                const tan = Math.abs(hy - p.y) / (hx - p.x); // tangential

                // if hole point sits on p's horizontal edge (T-junction touch): the bridge runs
                // along that edge — locallyInside rejects it as collinear, but it's valid
                if ((locallyInside(p, hole) || (p.y === hy && p.next.y === hy && p.next.x > hx)) &&
                    (tan < tanMin || (tan === tanMin && (p.x > m.x || (p.x === m.x && sectorContainsSector(m, p)))))) {
                    m = p;
                    tanMin = tan;
                }
            }

            p = p.next;
        } while (p !== stop);
    }

    return m;
}

// whether sector in vertex m contains sector in vertex p in the same coordinates
/** @param {Node} m @param {Node} p @returns {boolean} */
function sectorContainsSector(m, p) {
    return earcut_area(m.prev, m, p.prev) < 0 && earcut_area(p.next, m, m.next) < 0;
}

// scratch buffers reused across calls and grown on demand: two node-ref arrays that
// ping-pong during the radix passes, plus parallel z-value arrays so the passes read
// z from contiguous memory instead of dereferencing each node. 256-entry histogram for
// 8-bit digits; the small histogram keeps per-call setup cheap (most rings are short)
/** @type {Node[]} */
const sortArr = [];
/** @type {Node[]} */
let sortBuf = [];
let zArr = new Uint32Array(0);
let zBuf = new Uint32Array(0);
const counts = new Uint32Array(256);

// interlink polygon nodes in z-order: collect into an array, sort by z, relink
/** @param {Node} start @param {number} minX @param {number} minY @param {number} invSize */
function indexCurve(start, minX, minY, invSize) {
    let p = start;
    let n = 0;
    do {
        // always (re)compute: z may still hold a block index left over from eliminateHoles
        p.z = zOrder(p.x, p.y, minX, minY, invSize);
        sortArr[n++] = p;
        p = p.next;
    } while (p !== start);

    sortNodes(n);

    /** @type {Node | null} */
    let prev = null;
    for (let i = 0; i < n; i++) {
        const node = sortArr[i];
        node.prevZ = prev;
        if (prev) prev.nextZ = node;
        prev = node;
    }
    /** @type {Node} */ (prev).nextZ = null;

    // drop the node refs but keep the capacity: setting length to 0 leaves sortBuf unresized
    // (its growth is gated on zArr), so the radix scatter regrows it out of order every call
    sortArr.fill(/** @type {Node} */ (/** @type {unknown} */ (null)), 0, n);
    sortBuf.fill(/** @type {Node} */ (/** @type {unknown} */ (null)), 0, n);
}

// sort the first n nodes of sortArr by z, in place: insertion sort for small n (cheaper
// than histogram setup), else LSD radix in four 8-bit passes (covering z's 30 bits)
/** @param {number} n */
function sortNodes(n) {
    if (n <= 32) {
        for (let i = 1; i < n; i++) {
            const node = sortArr[i], z = node.z;
            let j = i - 1;
            while (j >= 0 && sortArr[j].z > z) { sortArr[j + 1] = sortArr[j]; j--; }
            sortArr[j + 1] = node;
        }
        return;
    }

    if (zArr.length < n) {
        zArr = new Uint32Array(n);
        zBuf = new Uint32Array(n);
        sortBuf = new Array(n);
    }
    for (let i = 0; i < n; i++) zArr[i] = sortArr[i].z;

    // even pass count lands the sorted result back in sortArr
    radixPass(n, sortArr, zArr, sortBuf, zBuf, 0);
    radixPass(n, sortBuf, zBuf, sortArr, zArr, 8);
    radixPass(n, sortArr, zArr, sortBuf, zBuf, 16);
    radixPass(n, sortBuf, zBuf, sortArr, zArr, 24);
}

// one LSD radix pass: stably scatter the first n nodes (and their z) from src to dst,
// bucketed by the 8-bit digit of z at the given bit shift
/** @param {number} n @param {Node[]} src @param {Uint32Array} srcZ @param {Node[]} dst @param {Uint32Array} dstZ @param {number} shift */
function radixPass(n, src, srcZ, dst, dstZ, shift) {
    counts.fill(0);
    for (let i = 0; i < n; i++) counts[(srcZ[i] >>> shift) & 0xff]++;
    // turn per-bucket counts into start offsets (prefix sum)
    let sum = 0;
    for (let b = 0; b < 256; b++) { const c = counts[b]; counts[b] = sum; sum += c; }
    for (let i = 0; i < n; i++) {
        const z = srcZ[i];
        const pos = counts[(z >>> shift) & 0xff]++;
        dst[pos] = src[i];
        dstZ[pos] = z;
    }
}

// z-order of a point given coords and inverse of the longer side of data bbox
/** @param {number} x @param {number} y @param {number} minX @param {number} minY @param {number} invSize @returns {number} */
function zOrder(x, y, minX, minY, invSize) {
    // coords are transformed into non-negative 15-bit integer range
    x = (x - minX) * invSize | 0;
    y = (y - minY) * invSize | 0;

    x = (x | (x << 8)) & 0x00FF00FF;
    x = (x | (x << 4)) & 0x0F0F0F0F;
    x = (x | (x << 2)) & 0x33333333;
    x = (x | (x << 1)) & 0x55555555;

    y = (y | (y << 8)) & 0x00FF00FF;
    y = (y | (y << 4)) & 0x0F0F0F0F;
    y = (y | (y << 2)) & 0x33333333;
    y = (y | (y << 1)) & 0x55555555;

    return x | (y << 1);
}

// find the leftmost node of a polygon ring
/** @param {Node} start @returns {Node} */
function getLeftmost(start) {
    let p = start,
        leftmost = start;
    do {
        if (p.x < leftmost.x || (p.x === leftmost.x && p.y < leftmost.y)) leftmost = p;
        p = p.next;
    } while (p !== start);

    return leftmost;
}

// check if a point lies within a convex triangle
/** @param {number} ax @param {number} ay @param {number} bx @param {number} by @param {number} cx @param {number} cy @param {number} px @param {number} py @returns {boolean} */
function pointInTriangle(ax, ay, bx, by, cx, cy, px, py) {
    return (cx - px) * (ay - py) >= (ax - px) * (cy - py) &&
           (ax - px) * (by - py) >= (bx - px) * (ay - py) &&
           (bx - px) * (cy - py) >= (cx - px) * (by - py);
}

// check if a diagonal between two polygon nodes is valid (lies in polygon interior)
/** @param {Node} a @param {Node} b @returns {boolean} true when the diagonal is valid */
function isValidDiagonal(a, b) {
    const zeroLength = equals(a, b) && earcut_area(a.prev, a, a.next) > 0 && earcut_area(b.prev, b, b.next) > 0; // degenerate case
    return a.next.i !== b.i && (zeroLength || locallyInside(a, b) && locallyInside(b, a) && // // locally visible
        (earcut_area(a.prev, a, b.prev) !== 0 || earcut_area(a, b.prev, b) !== 0)) && // no opposite-facing sectors
        !intersectsPolygon(a, b) && (zeroLength || middleInside(a, b)); // doesn't intersect other edges, diagonal inside polygon
}

// signed area of a triangle
/** @param {Node} p @param {Node} q @param {Node} r @returns {number} */
function earcut_area(p, q, r) {
    return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
}

// check if two points are equal
/** @param {Node} p1 @param {Node} p2 @returns {boolean} */
function equals(p1, p2) {
    return p1.x === p2.x && p1.y === p2.y;
}

// check if two segments intersect; by default includes collinear boundary touches
/** @param {Node} p1 @param {Node} q1 @param {Node} p2 @param {Node} q2 @param {boolean} [includeBoundary] @returns {boolean} */
function intersects(p1, q1, p2, q2, includeBoundary = true) {
    const o1 = earcut_area(p1, q1, p2);
    const o2 = earcut_area(p1, q1, q2);
    const o3 = earcut_area(p2, q2, p1);
    const o4 = earcut_area(p2, q2, q1);

    if (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) return true;

    if (!includeBoundary) return false;

    if (o1 === 0 && onSegment(p1, p2, q1)) return true; // p1, q1 and p2 are collinear and p2 lies on p1q1
    if (o2 === 0 && onSegment(p1, q2, q1)) return true; // p1, q1 and q2 are collinear and q2 lies on p1q1
    if (o3 === 0 && onSegment(p2, p1, q2)) return true; // p2, q2 and p1 are collinear and p1 lies on p2q2
    if (o4 === 0 && onSegment(p2, q1, q2)) return true; // p2, q2 and q1 are collinear and q1 lies on p2q2

    return false;
}

// for collinear points p, q, r, check if point q lies on segment pr
/** @param {Node} p @param {Node} q @param {Node} r @returns {boolean} */
function onSegment(p, q, r) {
    return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) && q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
}

// check if a polygon diagonal intersects any polygon segments
/** @param {Node} a @param {Node} b @returns {boolean} */
function intersectsPolygon(a, b) {
    // diagonal bbox; an edge whose bbox can't overlap it can't intersect it, so
    // skip the orientation test for those (the common case — the diagonal is short)
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);

    let p = a;
    do {
        const n = p.next;
        if ((p.x > maxX && n.x > maxX) || (p.x < minX && n.x < minX) ||
            (p.y > maxY && n.y > maxY) || (p.y < minY && n.y < minY)) {
            p = n;
            continue;
        }
        if (p.i !== a.i && n.i !== a.i && p.i !== b.i && n.i !== b.i &&
                intersects(p, n, a, b)) return true;
        p = n;
    } while (p !== a);

    return false;
}

// check if a polygon diagonal is locally inside the polygon
/** @param {Node} a @param {Node} b @returns {boolean} */
function locallyInside(a, b) {
    return earcut_area(a.prev, a, a.next) < 0 ?
        earcut_area(a, b, a.next) >= 0 && earcut_area(a, a.prev, b) >= 0 :
        earcut_area(a, b, a.prev) < 0 || earcut_area(a, a.next, b) < 0;
}

// check if the middle point of a polygon diagonal is inside the polygon
/** @param {Node} a @param {Node} b @returns {boolean} */
function middleInside(a, b) {
    let p = a;
    let inside = false;
    const px = (a.x + b.x) / 2;
    const py = (a.y + b.y) / 2;
    do {
        const n = p.next;
        if (((p.y > py) !== (n.y > py)) && (px < (n.x - p.x) * (py - p.y) / (n.y - p.y) + p.x))
            inside = !inside;
        p = n;
    } while (p !== a);

    return inside;
}

// link two polygon vertices with a bridge; if the vertices belong to the same ring, it splits polygon into two;
// if one belongs to the outer ring and another to a hole, it merges it into a single ring
/** @param {Node} a @param {Node} b @returns {Node} */
function splitPolygon(a, b) {
    const a2 = createNode(a.i, a.x, a.y),
        b2 = createNode(b.i, b.x, b.y),
        an = a.next,
        bp = b.prev;

    a.next = b;
    b.prev = a;

    a2.next = an;
    an.prev = a2;

    b2.next = a2;
    a2.prev = b2;

    bp.next = b2;
    b2.prev = bp;

    return b2;
}

// create a node and optionally link it with previous one (in a circular doubly linked list)
/** @param {number} i @param {number} x @param {number} y @param {Node | null} last @returns {Node} */
function insertNode(i, x, y, last) {
    const p = createNode(i, x, y);

    if (!last) {
        p.prev = p;
        p.next = p;

    } else {
        p.next = last.next;
        p.prev = last;
        last.next.prev = p;
        last.next = p;
    }
    return p;
}

/** @param {Node} p */
function removeNode(p) {
    p.next.prev = p.prev;
    p.prev.next = p.next;

    if (p.prevZ) p.prevZ.nextZ = p.nextZ;
    if (p.nextZ) p.nextZ.prevZ = p.prevZ;

    // keep the hole-bridge index's block bboxes covering the healed prev->next edge
    if (indexActive) growBlock(p.prev, p.next);
}

/** @param {number} i @param {number} x @param {number} y @returns {Node} */
function createNode(i, x, y) {
    // prev/next are assigned by the caller before any read, so the null init is cast away here
    return /** @type {Node} */ (/** @type {unknown} */ ({
        i, // vertex index in coordinates array
        x, y, // vertex coordinates
        prev: null, // previous and next vertex nodes in a polygon ring
        next: null,
        z: 0, // z-order curve value; doubles as owning block in the hole-bridge index during eliminateHoles
        prevZ: null, // previous and next nodes in z-order
        nextZ: null
    }));
}

/**
 * Return the relative difference between the polygon area and the area of its triangulation —
 * a value near 0 means a correct triangulation. Useful for verifying output in tests.
 *
 * @param {ArrayLike<number>} data
 * @param {ArrayLike<number> | null} holeIndices
 * @param {number} dim number of coordinates per vertex in `data`
 * @param {ArrayLike<number>} triangles output of {@link earcut}
 * @returns {number}
 * @example deviation(data, holes, dim, earcut(data, holes, dim)); // ~0 if correct
 */
function deviation(data, holeIndices, dim, triangles) {
    const hasHoles = holeIndices && holeIndices.length;
    const outerLen = hasHoles ? holeIndices[0] * dim : data.length;

    let polygonArea = Math.abs(signedArea(data, 0, outerLen, dim));
    if (hasHoles) {
        for (let i = 0, len = holeIndices.length; i < len; i++) {
            const start = holeIndices[i] * dim;
            const end = i < len - 1 ? holeIndices[i + 1] * dim : data.length;
            polygonArea -= Math.abs(signedArea(data, start, end, dim));
        }
    }

    let trianglesArea = 0;
    for (let i = 0; i < triangles.length; i += 3) {
        const a = triangles[i] * dim;
        const b = triangles[i + 1] * dim;
        const c = triangles[i + 2] * dim;
        trianglesArea += Math.abs(
            (data[a] - data[c]) * (data[b + 1] - data[a + 1]) -
            (data[a] - data[b]) * (data[c + 1] - data[a + 1]));
    }

    // with no triangles, a polygon area within shoelace roundoff of zero (which scales with the
    // squared coordinate magnitude) means the input was degenerate rather than mistriangulated
    if (trianglesArea === 0) {
        let max = 0;
        for (let i = 0; i < data.length; i += dim) max = Math.max(max, Math.abs(data[i]), Math.abs(data[i + 1]));
        return Math.abs(polygonArea) <= data.length * max * max * Number.EPSILON ? 0 : 1;
    }
    return Math.abs((trianglesArea - polygonArea) / polygonArea);
}

/** @param {ArrayLike<number>} data @param {number} start @param {number} end @param {number} dim @returns {number} */
function signedArea(data, start, end, dim) {
    let sum = 0;
    for (let i = start, j = end - dim; i < end; i += dim) {
        sum += (data[j] - data[i]) * (data[i + 1] + data[j + 1]);
        j = i;
    }
    return sum;
}

/**
 * Turn a polygon in multi-dimensional array form (e.g. as in GeoJSON) into the flat form Earcut accepts.
 *
 * @param {ReadonlyArray<ReadonlyArray<ArrayLike<number>>>} data array of rings; the first ring is the outer contour, the rest are holes
 * @returns {{vertices: number[], holes: number[], dimensions: number}}
 * @example const {vertices, holes, dimensions} = flatten(geojson.coordinates);
 */
function flatten(data) {
    const vertices = [];
    const holes = [];
    const dimensions = data[0][0].length;
    let holeIndex = 0;
    let prevLen = 0;

    for (const ring of data) {
        for (const p of ring) {
            for (let d = 0; d < dimensions; d++) vertices.push(p[d]);
        }
        if (prevLen) {
            holeIndex += prevLen;
            holes.push(holeIndex);
        }
        prevLen = ring.length;
    }
    return {vertices, holes, dimensions};
}

// Reusable module-level scratch for refine():
//   he      = twin half-edge of each edge, or -1 on the polygon boundary
//   hTable  = open-addressing hash, slot -> half-edge index, valid iff hStamp[slot] === gen
//   edgeStamp = pending-in-stack flag, cleared when the edge is popped
/** @type {Int32Array} */ let edgeStack;
/** @type {Int32Array} */ let he;
/** @type {Int32Array} */ let hTable;
/** @type {Uint32Array} */ let hStamp;
/** @type {Uint8Array} */ let edgeStamp;
let hMask = 0, gen = 0;

/**
 * Refine a triangulation toward the constrained Delaunay triangulation by legalizing every
 * interior edge in place with Lawson flips — maximizing the minimum angle and removing most
 * slivers. An optional post-pass for {@link earcut} output, or any manifold triangle-index array
 * indexing into `coords`. Adapted from delaunator's edge legalization.
 *
 * Uses non-robust predicates: float input is fine, and the worst case is a not-quite-Delaunay
 * edge, never an invalid mesh.
 *
 * @param {number[]} triangles triangle indices, as returned by {@link earcut}; mutated in place
 * @param {ArrayLike<number>} coords the flat vertex coordinates passed to {@link earcut}
 * @param {number} [dim=2] number of coordinates per vertex in `coords`
 * @example refine(earcut(data), data);
 */
function refine(triangles, coords, dim = 2) {
    const t = triangles;
    const n = t.length;
    if (n < 6) return;
    ensureScratch(n);
    gen++;              // bumping the generation logically empties the hash (no clearing)
    he.fill(-1, 0, n);

    // Build half-edge twins with an undirected-edge hash; consumed slots mark linked pairs. As each
    // pair is linked we seed the stack with one representative (s, the earlier-inserted edge) — this
    // fuses the initial "push every interior edge" pass into the build, saving a full O(n) scan.
    // edgeStamp is all-zero here (balanced push/pop leaves it clean) and each pair links once, so
    // the seed write needs no dedup guard.
    let i = 0;
    for (let e = 0; e < n; e++) {
        const a = t[e], b = t[nextHE(e)];
        const lo = a < b ? a : b, hi = a < b ? b : a;
        let h = (Math.imul(lo, 0x9e3779b1) ^ Math.imul(hi, 0x85ebca6b)) & hMask;
        while (hStamp[h] === gen) {
            const s = hTable[h];
            // s === -1 marks a consumed slot (a pair already linked) — skip past it
            if (s !== -1) {
                const sa = t[s], sb = t[nextHE(s)];
                if ((sa === lo && sb === hi) || (sa === hi && sb === lo)) {
                    he[e] = s; he[s] = e; hTable[h] = -1; // link, then consume the slot
                    edgeStamp[s] = 1; edgeStack[i++] = s; // seed the interior edge for the cascade
                    break;
                }
            }
            h = (h + 1) & hMask;
        }
        if (hStamp[h] !== gen) { hTable[h] = e; hStamp[h] = gen; } // first occurrence: insert
    }

    while (i > 0) {
        const a = edgeStack[--i];
        edgeStamp[a] = 0;
        const b = he[a];
        if (b === -1) continue;

        const a0 = a - a % 3;
        const b0 = b - b % 3;
        const ar = a0 + (a + 2) % 3;
        const al = a0 + (a + 1) % 3;
        const bl = b0 + (b + 2) % 3;
        const br = b0 + (b + 1) % 3;
        const p0 = t[ar], pr = t[a], pl = t[al], p1 = t[bl];

        const x0 = coords[p0 * dim], y0 = coords[p0 * dim + 1];
        const xr = coords[pr * dim], yr = coords[pr * dim + 1];
        const xl = coords[pl * dim], yl = coords[pl * dim + 1];
        const x1 = coords[p1 * dim], y1 = coords[p1 * dim + 1];

        // Test inCircle first: most interior edges are already Delaunay (inCircle true → no flip),
        // so this short-circuits before the two convexity orients on the common path. The quad must
        // also be convex (both new triangles CCW) — flipping a reflex quad would push a triangle
        // outside the polygon. Boundary/hole edges need no guard — they self-protect via he === -1.
        if (!inCircle(x0, y0, xr, yr, xl, yl, x1, y1) &&
            orient(x0, y0, xr, yr, x1, y1) > 0 && orient(x0, y0, x1, y1, xl, yl) > 0) {
            t[a] = p1; t[b] = p0;
            const hbl = he[bl], har = he[ar];
            he[a] = hbl; if (hbl !== -1) he[hbl] = a;
            he[b] = har; if (har !== -1) he[har] = b;
            he[ar] = bl; he[bl] = ar;

            // re-check the quad's four outer edges; skip boundary edges (he === -1) and any
            // already queued (edgeStamp), which also keeps the stack bounded by n.
            if (hbl    !== -1 && edgeStamp[a]  === 0) { edgeStamp[a]  = 1; edgeStack[i++] = a; }
            if (har    !== -1 && edgeStamp[b]  === 0) { edgeStamp[b]  = 1; edgeStack[i++] = b; }
            if (he[al] !== -1 && edgeStamp[al] === 0) { edgeStamp[al] = 1; edgeStack[i++] = al; }
            if (he[br] !== -1 && edgeStamp[br] === 0) { edgeStamp[br] = 1; edgeStack[i++] = br; }
        }
    }
}

/** @param {number} ax @param {number} ay @param {number} bx @param {number} by @param {number} cx @param {number} cy */
function orient(ax, ay, bx, by, cx, cy) {
    return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

// Whether p is inside or exactly on the circumcircle of triangle (a, b, c). Sign is negated vs the
// usual predicate to match earcut's CCW winding — the standard sign would build the anti-Delaunay
// mesh. Cocircular quads are legal ties, so refine only flips when this returns false.
/** @param {number} ax @param {number} ay @param {number} bx @param {number} by @param {number} cx @param {number} cy @param {number} px @param {number} py */
function inCircle(ax, ay, bx, by, cx, cy, px, py) {
    const dx = ax - px, dy = ay - py, ex = bx - px, ey = by - py, fx = cx - px, fy = cy - py;
    const ap = dx * dx + dy * dy, bp = ex * ex + ey * ey, cp = fx * fx + fy * fy;
    // A near-cocircular quad is a legal Delaunay tie, but roundoff can flag both an edge and its
    // flip as illegal, cascading into an endless flip loop (#205) — so treat a determinant within
    // a small margin of zero as a tie. The determinant's worst-case roundoff error is provably
    // below 9e-16·(ap + bp + cp)² (Shewchuk-style bound), so the margin guarantees every executed
    // flip is illegal in exact arithmetic, and Lawson flipping always terminates.
    const s = ap + bp + cp;
    return dx * (ey * cp - bp * fy) - dy * (ex * cp - bp * fx) + ap * (ex * fy - ey * fx) <= 1e-13 * s * s;
}

/** @param {number} e */
function nextHE(e) { // next half-edge within the same triangle
    return e - e % 3 + (e + 1) % 3;
}

// Grow the scratch arrays on demand (like earcut's z-order arrays). Allocating lazily here rather
// than at module load lets the whole refine() block tree-shake away for callers who don't use it.
/** @param {number} n */
function ensureScratch(n) {
    // edgeStack holds at most one entry per half-edge (edgeStamp dedups), so n is a safe cap —
    // sizing it up front lets the cascade push without a bounds/grow check.
    if (!edgeStack || edgeStack.length < n) edgeStack = new Int32Array(n);
    if (!he || he.length < n) he = new Int32Array(n);
    if (!edgeStamp || edgeStamp.length < n) edgeStamp = new Uint8Array(n);
    let size = 1;
    while (size < n * 4) size <<= 1; // power-of-two table, load factor <= 0.25
    if (!hTable || hTable.length < size) { hTable = new Int32Array(size); hStamp = new Uint32Array(size); }
    hMask = size - 1;
}

// EXTERNAL MODULE: ./node_modules/eventemitter3/index.mjs
var eventemitter3 = __webpack_require__(4486);
;// ./node_modules/pixi.js/lib/utils/utils.mjs



"use strict";
const utils_earcut = earcut["default"] || earcut;


//# sourceMappingURL=utils.mjs.map

;// ./node_modules/pixi.js/lib/scene/graphics/shared/utils/triangulateWithHoles.mjs


"use strict";
function triangulateWithHoles(points, holes, vertices, verticesStride, verticesOffset, indices, indicesOffset) {
  const triangles = utils_earcut(points, holes, 2);
  if (!triangles) {
    return;
  }
  for (let i = 0; i < triangles.length; i += 3) {
    indices[indicesOffset++] = triangles[i] + verticesOffset;
    indices[indicesOffset++] = triangles[i + 1] + verticesOffset;
    indices[indicesOffset++] = triangles[i + 2] + verticesOffset;
  }
  let index = verticesOffset * verticesStride;
  for (let i = 0; i < points.length; i += 2) {
    vertices[index] = points[i];
    vertices[index + 1] = points[i + 1];
    index += verticesStride;
  }
}


//# sourceMappingURL=triangulateWithHoles.mjs.map

;// ./node_modules/pixi.js/lib/scene/graphics/shared/buildCommands/buildPolygon.mjs



"use strict";
const emptyArray = [];
const buildPolygon = {
  extension: {
    type: Extensions/* ExtensionType */.Ag.ShapeBuilder,
    name: "polygon"
  },
  build(shape, points) {
    for (let i = 0; i < shape.points.length; i++) {
      points[i] = shape.points[i];
    }
    return true;
  },
  triangulate(points, vertices, verticesStride, verticesOffset, indices, indicesOffset) {
    triangulateWithHoles(points, emptyArray, vertices, verticesStride, verticesOffset, indices, indicesOffset);
  }
};


//# sourceMappingURL=buildPolygon.mjs.map

;// ./node_modules/pixi.js/lib/scene/graphics/shared/buildCommands/buildRectangle.mjs


"use strict";
const buildRectangle = {
  extension: {
    type: Extensions/* ExtensionType */.Ag.ShapeBuilder,
    name: "rectangle"
  },
  build(shape, points) {
    const rectData = shape;
    const x = rectData.x;
    const y = rectData.y;
    const width = rectData.width;
    const height = rectData.height;
    if (!(width > 0 && height > 0)) {
      return false;
    }
    points[0] = x;
    points[1] = y;
    points[2] = x + width;
    points[3] = y;
    points[4] = x + width;
    points[5] = y + height;
    points[6] = x;
    points[7] = y + height;
    return true;
  },
  triangulate(points, vertices, verticesStride, verticesOffset, indices, indicesOffset) {
    let count = 0;
    verticesOffset *= verticesStride;
    vertices[verticesOffset + count] = points[0];
    vertices[verticesOffset + count + 1] = points[1];
    count += verticesStride;
    vertices[verticesOffset + count] = points[2];
    vertices[verticesOffset + count + 1] = points[3];
    count += verticesStride;
    vertices[verticesOffset + count] = points[6];
    vertices[verticesOffset + count + 1] = points[7];
    count += verticesStride;
    vertices[verticesOffset + count] = points[4];
    vertices[verticesOffset + count + 1] = points[5];
    count += verticesStride;
    const verticesIndex = verticesOffset / verticesStride;
    indices[indicesOffset++] = verticesIndex;
    indices[indicesOffset++] = verticesIndex + 1;
    indices[indicesOffset++] = verticesIndex + 2;
    indices[indicesOffset++] = verticesIndex + 1;
    indices[indicesOffset++] = verticesIndex + 3;
    indices[indicesOffset++] = verticesIndex + 2;
  }
};


//# sourceMappingURL=buildRectangle.mjs.map

;// ./node_modules/pixi.js/lib/scene/graphics/shared/buildCommands/buildTriangle.mjs


"use strict";
const buildTriangle = {
  extension: {
    type: Extensions/* ExtensionType */.Ag.ShapeBuilder,
    name: "triangle"
  },
  build(shape, points) {
    points[0] = shape.x;
    points[1] = shape.y;
    points[2] = shape.x2;
    points[3] = shape.y2;
    points[4] = shape.x3;
    points[5] = shape.y3;
    return true;
  },
  triangulate(points, vertices, verticesStride, verticesOffset, indices, indicesOffset) {
    let count = 0;
    verticesOffset *= verticesStride;
    vertices[verticesOffset + count] = points[0];
    vertices[verticesOffset + count + 1] = points[1];
    count += verticesStride;
    vertices[verticesOffset + count] = points[2];
    vertices[verticesOffset + count + 1] = points[3];
    count += verticesStride;
    vertices[verticesOffset + count] = points[4];
    vertices[verticesOffset + count + 1] = points[5];
    const verticesIndex = verticesOffset / verticesStride;
    indices[indicesOffset++] = verticesIndex;
    indices[indicesOffset++] = verticesIndex + 1;
    indices[indicesOffset++] = verticesIndex + 2;
  }
};


//# sourceMappingURL=buildTriangle.mjs.map

// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/graphics/shared/fill/FillGradient.mjs
var FillGradient = __webpack_require__(7276);
;// ./node_modules/pixi.js/lib/scene/graphics/shared/utils/generateTextureFillMatrix.mjs




"use strict";
const tempTextureMatrix = new Matrix/* Matrix */.u();
const tempRect = new Rectangle/* Rectangle */.M();
function generateTextureMatrix(out, style, shape, matrix) {
  const textureMatrix = style.matrix ? out.copyFrom(style.matrix).invert() : out.identity();
  if (style.textureSpace === "local") {
    const bounds = shape.getBounds(tempRect);
    if (style.width) {
      bounds.pad(style.width);
    }
    const { x: tx, y: ty } = bounds;
    const sx = 1 / bounds.width;
    const sy = 1 / bounds.height;
    const mTx = -tx * sx;
    const mTy = -ty * sy;
    const a1 = textureMatrix.a;
    const b1 = textureMatrix.b;
    const c1 = textureMatrix.c;
    const d1 = textureMatrix.d;
    textureMatrix.a *= sx;
    textureMatrix.b *= sx;
    textureMatrix.c *= sy;
    textureMatrix.d *= sy;
    textureMatrix.tx = mTx * a1 + mTy * c1 + textureMatrix.tx;
    textureMatrix.ty = mTx * b1 + mTy * d1 + textureMatrix.ty;
  } else {
    textureMatrix.translate(style.texture.frame.x, style.texture.frame.y);
    textureMatrix.scale(1 / style.texture.source.width, 1 / style.texture.source.height);
  }
  const sourceStyle = style.texture.source.style;
  if (!(style.fill instanceof FillGradient/* FillGradient */._) && sourceStyle.addressMode === "clamp-to-edge") {
    sourceStyle.addressMode = "repeat";
    sourceStyle.update();
  }
  if (matrix) {
    textureMatrix.append(tempTextureMatrix.copyFrom(matrix).invert());
  }
  return textureMatrix;
}


//# sourceMappingURL=generateTextureFillMatrix.mjs.map

;// ./node_modules/pixi.js/lib/scene/graphics/shared/utils/buildContextBatches.mjs

















"use strict";
const shapeBuilders = {};
Extensions/* extensions */.XO.handleByMap(Extensions/* ExtensionType */.Ag.ShapeBuilder, shapeBuilders);
Extensions/* extensions */.XO.add(buildRectangle, buildPolygon, buildTriangle, buildCircle, buildEllipse, buildRoundedRectangle);
const buildContextBatches_tempRect = new Rectangle/* Rectangle */.M();
const buildContextBatches_tempTextureMatrix = new Matrix/* Matrix */.u();
function buildContextBatches(context, gpuContext) {
  const { geometryData, batches } = gpuContext;
  batches.length = 0;
  geometryData.indices.length = 0;
  geometryData.vertices.length = 0;
  geometryData.uvs.length = 0;
  for (let i = 0; i < context.instructions.length; i++) {
    const instruction = context.instructions[i];
    if (instruction.action === "texture") {
      addTextureToGeometryData(instruction.data, batches, geometryData);
    } else if (instruction.action === "fill" || instruction.action === "stroke") {
      const isStroke = instruction.action === "stroke";
      const shapePath = instruction.data.path.shapePath;
      const style = instruction.data.style;
      const hole = instruction.data.hole;
      if (isStroke && hole) {
        addShapePathToGeometryData(hole.shapePath, style, true, batches, geometryData);
      }
      if (hole) {
        shapePath.shapePrimitives[shapePath.shapePrimitives.length - 1].holes = hole.shapePath.shapePrimitives;
      }
      addShapePathToGeometryData(shapePath, style, isStroke, batches, geometryData);
    }
  }
}
function addTextureToGeometryData(data, batches, geometryData) {
  const points = [];
  const build = shapeBuilders.rectangle;
  const rect = buildContextBatches_tempRect;
  rect.x = data.dx;
  rect.y = data.dy;
  rect.width = data.dw;
  rect.height = data.dh;
  const matrix = data.transform;
  if (!build.build(rect, points)) {
    return;
  }
  const { vertices, uvs, indices } = geometryData;
  const indexOffset = indices.length;
  const vertOffset = vertices.length / 2;
  if (matrix) {
    transformVertices(points, matrix);
  }
  build.triangulate(points, vertices, 2, vertOffset, indices, indexOffset);
  const texture = data.image;
  const textureUvs = texture.uvs;
  uvs.push(
    textureUvs.x0,
    textureUvs.y0,
    textureUvs.x1,
    textureUvs.y1,
    textureUvs.x3,
    textureUvs.y3,
    textureUvs.x2,
    textureUvs.y2
  );
  const graphicsBatch = PoolGroup/* BigPool */.Z.get(BatchableGraphics/* BatchableGraphics */.G);
  graphicsBatch.indexOffset = indexOffset;
  graphicsBatch.indexSize = indices.length - indexOffset;
  graphicsBatch.attributeOffset = vertOffset;
  graphicsBatch.attributeSize = vertices.length / 2 - vertOffset;
  graphicsBatch.baseColor = data.style;
  graphicsBatch.alpha = data.alpha;
  graphicsBatch.texture = texture;
  graphicsBatch.geometryData = geometryData;
  batches.push(graphicsBatch);
}
function addShapePathToGeometryData(shapePath, style, isStroke, batches, geometryData) {
  const { vertices, uvs, indices } = geometryData;
  shapePath.shapePrimitives.forEach(({ shape, transform: matrix, holes }) => {
    const points = [];
    const build = shapeBuilders[shape.type];
    if (!build.build(shape, points)) {
      return;
    }
    const indexOffset = indices.length;
    const vertOffset = vertices.length / 2;
    let topology = "triangle-list";
    if (matrix) {
      transformVertices(points, matrix);
    }
    if (!isStroke) {
      if (holes) {
        const holeIndices = [];
        const otherPoints = points.slice();
        const holeArrays = getHoleArrays(holes);
        holeArrays.forEach((holePoints) => {
          holeIndices.push(otherPoints.length / 2);
          otherPoints.push(...holePoints);
        });
        triangulateWithHoles(otherPoints, holeIndices, vertices, 2, vertOffset, indices, indexOffset);
      } else {
        build.triangulate(points, vertices, 2, vertOffset, indices, indexOffset);
      }
    } else {
      const close = shape.closePath ?? true;
      const lineStyle = style;
      if (!lineStyle.pixelLine) {
        buildLine(points, lineStyle, false, close, vertices, indices);
      } else {
        buildPixelLine(points, close, vertices, indices);
        topology = "line-list";
      }
    }
    const uvsOffset = uvs.length / 2;
    const texture = style.texture;
    if (texture !== Texture/* Texture */.g.WHITE) {
      const textureMatrix = generateTextureMatrix(buildContextBatches_tempTextureMatrix, style, shape, matrix);
      buildUvs(vertices, 2, vertOffset, uvs, uvsOffset, 2, vertices.length / 2 - vertOffset, textureMatrix);
    } else {
      buildSimpleUvs(uvs, uvsOffset, 2, vertices.length / 2 - vertOffset);
    }
    const graphicsBatch = PoolGroup/* BigPool */.Z.get(BatchableGraphics/* BatchableGraphics */.G);
    graphicsBatch.indexOffset = indexOffset;
    graphicsBatch.indexSize = indices.length - indexOffset;
    graphicsBatch.attributeOffset = vertOffset;
    graphicsBatch.attributeSize = vertices.length / 2 - vertOffset;
    graphicsBatch.baseColor = style.color;
    graphicsBatch.alpha = style.alpha;
    graphicsBatch.texture = texture;
    graphicsBatch.geometryData = geometryData;
    graphicsBatch.topology = topology;
    batches.push(graphicsBatch);
  });
}
function getHoleArrays(holePrimitives) {
  const holeArrays = [];
  for (let k = 0; k < holePrimitives.length; k++) {
    const holePrimitive = holePrimitives[k].shape;
    const holePoints = [];
    const holeBuilder = shapeBuilders[holePrimitive.type];
    if (holeBuilder.build(holePrimitive, holePoints)) {
      holeArrays.push(holePoints);
    }
  }
  return holeArrays;
}


//# sourceMappingURL=buildContextBatches.mjs.map

;// ./node_modules/pixi.js/lib/scene/graphics/shared/GraphicsContextSystem.mjs








"use strict";
class GpuGraphicsContext {
  constructor() {
    this.batches = [];
    this.geometryData = {
      vertices: [],
      uvs: [],
      indices: []
    };
  }
}
class GraphicsContextRenderData {
  constructor() {
    this.instructions = new InstructionSet/* InstructionSet */.L();
  }
  init(maxTextures) {
    this.batcher = new DefaultBatcher/* DefaultBatcher */.J({
      maxTextures
    });
    this.instructions.reset();
  }
  /**
   * @deprecated since version 8.0.0
   * Use `batcher.geometry` instead.
   * @see {Batcher#geometry}
   */
  get geometry() {
    (0,deprecation/* deprecation */.t6)(deprecation/* v8_3_4 */.Ek, "GraphicsContextRenderData#geometry is deprecated, please use batcher.geometry instead.");
    return this.batcher.geometry;
  }
  destroy() {
    this.batcher.destroy();
    this.instructions.destroy();
    this.batcher = null;
    this.instructions = null;
  }
}
const _GraphicsContextSystem = class _GraphicsContextSystem {
  constructor(renderer) {
    // the root context batches, used to either make a batch or geometry
    // all graphics use this as a base
    this._gpuContextHash = {};
    // used for non-batchable graphics
    this._graphicsDataContextHash = /* @__PURE__ */ Object.create(null);
    this._renderer = renderer;
    renderer.renderableGC.addManagedHash(this, "_gpuContextHash");
    renderer.renderableGC.addManagedHash(this, "_graphicsDataContextHash");
  }
  /**
   * Runner init called, update the default options
   * @ignore
   */
  init(options) {
    _GraphicsContextSystem.defaultOptions.bezierSmoothness = options?.bezierSmoothness ?? _GraphicsContextSystem.defaultOptions.bezierSmoothness;
  }
  /**
   * Returns the render data for a given GraphicsContext.
   * @param context - The GraphicsContext to get the render data for.
   * @internal
   */
  getContextRenderData(context) {
    return this._graphicsDataContextHash[context.uid] || this._initContextRenderData(context);
  }
  /**
   * Updates the GPU context for a given GraphicsContext.
   * If the context is dirty, it will rebuild the batches and geometry data.
   * @param context - The GraphicsContext to update.
   * @returns The updated GpuGraphicsContext.
   * @internal
   */
  updateGpuContext(context) {
    let gpuContext = this._gpuContextHash[context.uid] || this._initContext(context);
    if (context.dirty) {
      if (gpuContext) {
        this._cleanGraphicsContextData(context);
      } else {
        gpuContext = this._initContext(context);
      }
      buildContextBatches(context, gpuContext);
      const batchMode = context.batchMode;
      if (context.customShader || batchMode === "no-batch") {
        gpuContext.isBatchable = false;
      } else if (batchMode === "auto") {
        gpuContext.isBatchable = gpuContext.geometryData.vertices.length < 400;
      } else {
        gpuContext.isBatchable = true;
      }
      context.dirty = false;
    }
    return gpuContext;
  }
  /**
   * Returns the GpuGraphicsContext for a given GraphicsContext.
   * If it does not exist, it will initialize a new one.
   * @param context - The GraphicsContext to get the GpuGraphicsContext for.
   * @returns The GpuGraphicsContext for the given GraphicsContext.
   * @internal
   */
  getGpuContext(context) {
    return this._gpuContextHash[context.uid] || this._initContext(context);
  }
  _initContextRenderData(context) {
    const graphicsData = PoolGroup/* BigPool */.Z.get(GraphicsContextRenderData, {
      maxTextures: this._renderer.limits.maxBatchableTextures
    });
    const { batches, geometryData } = this._gpuContextHash[context.uid];
    const vertexSize = geometryData.vertices.length;
    const indexSize = geometryData.indices.length;
    for (let i = 0; i < batches.length; i++) {
      batches[i].applyTransform = false;
    }
    const batcher = graphicsData.batcher;
    batcher.ensureAttributeBuffer(vertexSize);
    batcher.ensureIndexBuffer(indexSize);
    batcher.begin();
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      batcher.add(batch);
    }
    batcher.finish(graphicsData.instructions);
    const geometry = batcher.geometry;
    geometry.indexBuffer.setDataWithSize(batcher.indexBuffer, batcher.indexSize, true);
    geometry.buffers[0].setDataWithSize(batcher.attributeBuffer.float32View, batcher.attributeSize, true);
    const drawBatches = batcher.batches;
    for (let i = 0; i < drawBatches.length; i++) {
      const batch = drawBatches[i];
      batch.bindGroup = getTextureBatchBindGroup(
        batch.textures.textures,
        batch.textures.count,
        this._renderer.limits.maxBatchableTextures
      );
    }
    this._graphicsDataContextHash[context.uid] = graphicsData;
    return graphicsData;
  }
  _initContext(context) {
    const gpuContext = new GpuGraphicsContext();
    gpuContext.context = context;
    this._gpuContextHash[context.uid] = gpuContext;
    context.on("destroy", this.onGraphicsContextDestroy, this);
    return this._gpuContextHash[context.uid];
  }
  onGraphicsContextDestroy(context) {
    this._cleanGraphicsContextData(context);
    context.off("destroy", this.onGraphicsContextDestroy, this);
    this._gpuContextHash[context.uid] = null;
  }
  _cleanGraphicsContextData(context) {
    const gpuContext = this._gpuContextHash[context.uid];
    if (!gpuContext.isBatchable) {
      if (this._graphicsDataContextHash[context.uid]) {
        PoolGroup/* BigPool */.Z.return(this.getContextRenderData(context));
        this._graphicsDataContextHash[context.uid] = null;
      }
    }
    if (gpuContext.batches) {
      gpuContext.batches.forEach((batch) => {
        PoolGroup/* BigPool */.Z.return(batch);
      });
    }
  }
  destroy() {
    for (const i in this._gpuContextHash) {
      if (this._gpuContextHash[i]) {
        this.onGraphicsContextDestroy(this._gpuContextHash[i].context);
      }
    }
  }
};
/** @ignore */
_GraphicsContextSystem.extension = {
  type: [
    Extensions/* ExtensionType */.Ag.WebGLSystem,
    Extensions/* ExtensionType */.Ag.WebGPUSystem,
    Extensions/* ExtensionType */.Ag.CanvasSystem
  ],
  name: "graphicsContext"
};
/** The default options for the GraphicsContextSystem. */
_GraphicsContextSystem.defaultOptions = {
  /**
   * A value from 0 to 1 that controls the smoothness of bezier curves (the higher the smoother)
   * @default 0.5
   */
  bezierSmoothness: 0.5
};
let GraphicsContextSystem = _GraphicsContextSystem;


//# sourceMappingURL=GraphicsContextSystem.mjs.map


/***/ },

/***/ 7276
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   _: () => (/* binding */ FillGradient)
/* harmony export */ });
/* harmony import */ var _color_Color_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3556);
/* harmony import */ var _environment_adapter_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(6559);
/* harmony import */ var _maths_matrix_Matrix_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(9313);
/* harmony import */ var _rendering_renderers_shared_texture_sources_ImageSource_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(8293);
/* harmony import */ var _rendering_renderers_shared_texture_Texture_mjs__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(226);
/* harmony import */ var _utils_data_uid_mjs__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(133);
/* harmony import */ var _utils_logging_deprecation_mjs__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(4670);
/* harmony import */ var _container_utils_definedProps_mjs__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(2698);









"use strict";
const emptyColorStops = [{ offset: 0, color: "white" }, { offset: 1, color: "black" }];
const _FillGradient = class _FillGradient {
  constructor(...args) {
    /**
     * Unique identifier for this gradient instance
     * @internal
     */
    this.uid = (0,_utils_data_uid_mjs__WEBPACK_IMPORTED_MODULE_5__/* .uid */ .L)("fillGradient");
    /**
     * Internal tick counter to track changes in the gradient.
     * This is used to invalidate the gradient when the texture changes.
     * @internal
     */
    this._tick = 0;
    /** Type of gradient - currently only supports 'linear' */
    this.type = "linear";
    /** Array of color stops defining the gradient */
    this.colorStops = [];
    let options = ensureGradientOptions(args);
    const defaults = options.type === "radial" ? _FillGradient.defaultRadialOptions : _FillGradient.defaultLinearOptions;
    options = { ...defaults, ...(0,_container_utils_definedProps_mjs__WEBPACK_IMPORTED_MODULE_7__/* .definedProps */ .S)(options) };
    this._textureSize = options.textureSize;
    this._wrapMode = options.wrapMode;
    if (options.type === "radial") {
      this.center = options.center;
      this.outerCenter = options.outerCenter ?? this.center;
      this.innerRadius = options.innerRadius;
      this.outerRadius = options.outerRadius;
      this.scale = options.scale;
      this.rotation = options.rotation;
    } else {
      this.start = options.start;
      this.end = options.end;
    }
    this.textureSpace = options.textureSpace;
    this.type = options.type;
    options.colorStops.forEach((stop) => {
      this.addColorStop(stop.offset, stop.color);
    });
  }
  /**
   * Adds a color stop to the gradient
   * @param offset - Position of the stop (0-1)
   * @param color - Color of the stop
   * @returns This gradient instance for chaining
   */
  addColorStop(offset, color) {
    this.colorStops.push({ offset, color: _color_Color_mjs__WEBPACK_IMPORTED_MODULE_0__/* .Color */ .Q.shared.setValue(color).toHexa() });
    return this;
  }
  /**
   * Builds the internal texture and transform for the gradient.
   * Called automatically when the gradient is first used.
   * @internal
   */
  buildLinearGradient() {
    if (this.texture)
      return;
    let { x: x0, y: y0 } = this.start;
    let { x: x1, y: y1 } = this.end;
    let dx = x1 - x0;
    let dy = y1 - y0;
    const flip = dx < 0 || dy < 0;
    if (this._wrapMode === "clamp-to-edge") {
      if (dx < 0) {
        const temp = x0;
        x0 = x1;
        x1 = temp;
        dx *= -1;
      }
      if (dy < 0) {
        const temp = y0;
        y0 = y1;
        y1 = temp;
        dy *= -1;
      }
    }
    const colorStops = this.colorStops.length ? this.colorStops : emptyColorStops;
    const defaultSize = this._textureSize;
    const { canvas, context } = getCanvas(defaultSize, 1);
    const gradient = !flip ? context.createLinearGradient(0, 0, this._textureSize, 0) : context.createLinearGradient(this._textureSize, 0, 0, 0);
    addColorStops(gradient, colorStops);
    context.fillStyle = gradient;
    context.fillRect(0, 0, defaultSize, 1);
    this.texture = new _rendering_renderers_shared_texture_Texture_mjs__WEBPACK_IMPORTED_MODULE_4__/* .Texture */ .g({
      source: new _rendering_renderers_shared_texture_sources_ImageSource_mjs__WEBPACK_IMPORTED_MODULE_3__/* .ImageSource */ .b({
        resource: canvas,
        addressMode: this._wrapMode
      })
    });
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const m = new _maths_matrix_Matrix_mjs__WEBPACK_IMPORTED_MODULE_2__/* .Matrix */ .u();
    m.scale(dist / defaultSize, 1);
    m.rotate(angle);
    m.translate(x0, y0);
    if (this.textureSpace === "local") {
      m.scale(defaultSize, defaultSize);
    }
    this.transform = m;
  }
  /**
   * Builds the internal texture and transform for the gradient.
   * Called automatically when the gradient is first used.
   * @internal
   */
  buildGradient() {
    if (!this.texture)
      this._tick++;
    if (this.type === "linear") {
      this.buildLinearGradient();
    } else {
      this.buildRadialGradient();
    }
  }
  /**
   * Builds the internal texture and transform for the radial gradient.
   * Called automatically when the gradient is first used.
   * @internal
   */
  buildRadialGradient() {
    if (this.texture)
      return;
    const colorStops = this.colorStops.length ? this.colorStops : emptyColorStops;
    const defaultSize = this._textureSize;
    const { canvas, context } = getCanvas(defaultSize, defaultSize);
    const { x: x0, y: y0 } = this.center;
    const { x: x1, y: y1 } = this.outerCenter;
    const r0 = this.innerRadius;
    const r1 = this.outerRadius;
    const ox = x1 - r1;
    const oy = y1 - r1;
    const scale = defaultSize / (r1 * 2);
    const cx = (x0 - ox) * scale;
    const cy = (y0 - oy) * scale;
    const gradient = context.createRadialGradient(
      cx,
      cy,
      r0 * scale,
      (x1 - ox) * scale,
      (y1 - oy) * scale,
      r1 * scale
    );
    addColorStops(gradient, colorStops);
    context.fillStyle = colorStops[colorStops.length - 1].color;
    context.fillRect(0, 0, defaultSize, defaultSize);
    context.fillStyle = gradient;
    context.translate(cx, cy);
    context.rotate(this.rotation);
    context.scale(1, this.scale);
    context.translate(-cx, -cy);
    context.fillRect(0, 0, defaultSize, defaultSize);
    this.texture = new _rendering_renderers_shared_texture_Texture_mjs__WEBPACK_IMPORTED_MODULE_4__/* .Texture */ .g({
      source: new _rendering_renderers_shared_texture_sources_ImageSource_mjs__WEBPACK_IMPORTED_MODULE_3__/* .ImageSource */ .b({
        resource: canvas,
        addressMode: this._wrapMode
      })
    });
    const m = new _maths_matrix_Matrix_mjs__WEBPACK_IMPORTED_MODULE_2__/* .Matrix */ .u();
    m.scale(1 / scale, 1 / scale);
    m.translate(ox, oy);
    if (this.textureSpace === "local") {
      m.scale(defaultSize, defaultSize);
    }
    this.transform = m;
  }
  /** Destroys the gradient, releasing resources. This will also destroy the internal texture. */
  destroy() {
    this.texture?.destroy(true);
    this.texture = null;
    this.transform = null;
    this.colorStops = [];
    this.start = null;
    this.end = null;
    this.center = null;
    this.outerCenter = null;
  }
  /**
   * Returns a unique key for this gradient instance.
   * This key is used for caching and texture management.
   * @returns {string} Unique key for the gradient
   */
  get styleKey() {
    return `fill-gradient-${this.uid}-${this._tick}`;
  }
};
/** Default options for creating a gradient fill */
_FillGradient.defaultLinearOptions = {
  start: { x: 0, y: 0 },
  end: { x: 0, y: 1 },
  colorStops: [],
  textureSpace: "local",
  type: "linear",
  textureSize: 256,
  wrapMode: "clamp-to-edge"
};
/** Default options for creating a radial gradient fill */
_FillGradient.defaultRadialOptions = {
  center: { x: 0.5, y: 0.5 },
  innerRadius: 0,
  outerRadius: 0.5,
  colorStops: [],
  scale: 1,
  textureSpace: "local",
  type: "radial",
  textureSize: 256,
  wrapMode: "clamp-to-edge"
};
let FillGradient = _FillGradient;
function addColorStops(gradient, colorStops) {
  for (let i = 0; i < colorStops.length; i++) {
    const stop = colorStops[i];
    gradient.addColorStop(stop.offset, stop.color);
  }
}
function getCanvas(width, height) {
  const canvas = _environment_adapter_mjs__WEBPACK_IMPORTED_MODULE_1__/* .DOMAdapter */ .e.get().createCanvas(width, height);
  const context = canvas.getContext("2d");
  return { canvas, context };
}
function ensureGradientOptions(args) {
  let options = args[0] ?? {};
  if (typeof options === "number" || args[1]) {
    (0,_utils_logging_deprecation_mjs__WEBPACK_IMPORTED_MODULE_6__/* .deprecation */ .t6)("8.5.2", `use options object instead`);
    options = {
      type: "linear",
      start: { x: args[0], y: args[1] },
      end: { x: args[2], y: args[3] },
      textureSpace: args[4],
      textureSize: args[5] ?? FillGradient.defaultLinearOptions.textureSize
    };
  }
  return options;
}


//# sourceMappingURL=FillGradient.mjs.map


/***/ },

/***/ 2806
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   m: () => (/* binding */ FillPattern)
/* harmony export */ });
/* harmony import */ var _maths_matrix_Matrix_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9313);
/* harmony import */ var _utils_data_uid_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(133);



"use strict";
const repetitionMap = {
  repeat: {
    addressModeU: "repeat",
    addressModeV: "repeat"
  },
  "repeat-x": {
    addressModeU: "repeat",
    addressModeV: "clamp-to-edge"
  },
  "repeat-y": {
    addressModeU: "clamp-to-edge",
    addressModeV: "repeat"
  },
  "no-repeat": {
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge"
  }
};
class FillPattern {
  constructor(texture, repetition) {
    /**
     * unique id for this fill pattern
     * @internal
     */
    this.uid = (0,_utils_data_uid_mjs__WEBPACK_IMPORTED_MODULE_1__/* .uid */ .L)("fillPattern");
    /**
     * Internal tick counter to track changes in the pattern.
     * This is used to invalidate the pattern when the texture or transform changes.
     * @internal
     */
    this._tick = 0;
    /** The transform matrix applied to the pattern */
    this.transform = new _maths_matrix_Matrix_mjs__WEBPACK_IMPORTED_MODULE_0__/* .Matrix */ .u();
    this.texture = texture;
    this.transform.scale(
      1 / texture.frame.width,
      1 / texture.frame.height
    );
    if (repetition) {
      texture.source.style.addressModeU = repetitionMap[repetition].addressModeU;
      texture.source.style.addressModeV = repetitionMap[repetition].addressModeV;
    }
  }
  /**
   * Sets the transform for the pattern
   * @param transform - The transform matrix to apply to the pattern.
   * If not provided, the pattern will use the default transform.
   */
  setTransform(transform) {
    const texture = this.texture;
    this.transform.copyFrom(transform);
    this.transform.invert();
    this.transform.scale(
      1 / texture.frame.width,
      1 / texture.frame.height
    );
    this._tick++;
  }
  /** Internal texture used to render the gradient */
  get texture() {
    return this._texture;
  }
  set texture(value) {
    if (this._texture === value)
      return;
    this._texture = value;
    this._tick++;
  }
  /**
   * Returns a unique key for this instance.
   * This key is used for caching.
   * @returns {string} Unique key for the instance
   */
  get styleKey() {
    return `fill-pattern-${this.uid}-${this._tick}`;
  }
  /** Destroys the fill pattern, releasing resources. This will also destroy the internal texture. */
  destroy() {
    this.texture.destroy(true);
    this.texture = null;
  }
}


//# sourceMappingURL=FillPattern.mjs.map


/***/ },

/***/ 990
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   T: () => (/* binding */ toStrokeStyle),
/* harmony export */   w: () => (/* binding */ toFillStyle)
/* harmony export */ });
/* harmony import */ var _color_Color_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3556);
/* harmony import */ var _rendering_renderers_shared_texture_Texture_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(226);
/* harmony import */ var _fill_FillGradient_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(7276);
/* harmony import */ var _fill_FillPattern_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(2806);





"use strict";
function isColorLike(value) {
  return _color_Color_mjs__WEBPACK_IMPORTED_MODULE_0__/* .Color */ .Q.isColorLike(value);
}
function isFillPattern(value) {
  return value instanceof _fill_FillPattern_mjs__WEBPACK_IMPORTED_MODULE_3__/* .FillPattern */ .m;
}
function isFillGradient(value) {
  return value instanceof _fill_FillGradient_mjs__WEBPACK_IMPORTED_MODULE_2__/* .FillGradient */ ._;
}
function isTexture(value) {
  return value instanceof _rendering_renderers_shared_texture_Texture_mjs__WEBPACK_IMPORTED_MODULE_1__/* .Texture */ .g;
}
function handleColorLike(fill, value, defaultStyle) {
  const temp = _color_Color_mjs__WEBPACK_IMPORTED_MODULE_0__/* .Color */ .Q.shared.setValue(value ?? 0);
  fill.color = temp.toNumber();
  fill.alpha = temp.alpha === 1 ? defaultStyle.alpha : temp.alpha;
  fill.texture = _rendering_renderers_shared_texture_Texture_mjs__WEBPACK_IMPORTED_MODULE_1__/* .Texture */ .g.WHITE;
  return { ...defaultStyle, ...fill };
}
function handleTexture(fill, value, defaultStyle) {
  fill.texture = value;
  return { ...defaultStyle, ...fill };
}
function handleFillPattern(fill, value, defaultStyle) {
  fill.fill = value;
  fill.color = 16777215;
  fill.texture = value.texture;
  fill.matrix = value.transform;
  return { ...defaultStyle, ...fill };
}
function handleFillGradient(fill, value, defaultStyle) {
  value.buildGradient();
  fill.fill = value;
  fill.color = 16777215;
  fill.texture = value.texture;
  fill.matrix = value.transform;
  fill.textureSpace = value.textureSpace;
  return { ...defaultStyle, ...fill };
}
function handleFillObject(value, defaultStyle) {
  const style = { ...defaultStyle, ...value };
  const color = _color_Color_mjs__WEBPACK_IMPORTED_MODULE_0__/* .Color */ .Q.shared.setValue(style.color);
  style.alpha *= color.alpha;
  style.color = color.toNumber();
  return style;
}
function toFillStyle(value, defaultStyle) {
  if (value === void 0 || value === null) {
    return null;
  }
  const fill = {};
  const objectStyle = value;
  if (isColorLike(value)) {
    return handleColorLike(fill, value, defaultStyle);
  } else if (isTexture(value)) {
    return handleTexture(fill, value, defaultStyle);
  } else if (isFillPattern(value)) {
    return handleFillPattern(fill, value, defaultStyle);
  } else if (isFillGradient(value)) {
    return handleFillGradient(fill, value, defaultStyle);
  } else if (objectStyle.fill && isFillPattern(objectStyle.fill)) {
    return handleFillPattern(objectStyle, objectStyle.fill, defaultStyle);
  } else if (objectStyle.fill && isFillGradient(objectStyle.fill)) {
    return handleFillGradient(objectStyle, objectStyle.fill, defaultStyle);
  }
  return handleFillObject(objectStyle, defaultStyle);
}
function toStrokeStyle(value, defaultStyle) {
  const { width, alignment, miterLimit, cap, join, pixelLine, ...rest } = defaultStyle;
  const fill = toFillStyle(value, rest);
  if (!fill) {
    return null;
  }
  return {
    width,
    alignment,
    miterLimit,
    cap,
    join,
    pixelLine,
    ...fill
  };
}


//# sourceMappingURL=convertFillInputToFillStyle.mjs.map


/***/ },

/***/ 7634
(__unused_webpack___webpack_module__, __unused_webpack___webpack_exports__, __webpack_require__) {

"use strict";

// EXTERNAL MODULE: ./node_modules/pixi.js/lib/extensions/Extensions.mjs
var Extensions = __webpack_require__(8507);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/maths/matrix/Matrix.mjs
var Matrix = __webpack_require__(9313);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/gpu/shader/BindGroup.mjs
var BindGroup = __webpack_require__(3513);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/shader/UniformGroup.mjs + 2 modules
var UniformGroup = __webpack_require__(1911);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/state/getAdjustedBlendModeBlend.mjs
var getAdjustedBlendModeBlend = __webpack_require__(8639);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/graphics/gpu/colorToUniform.mjs
var colorToUniform = __webpack_require__(2760);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/mesh/shared/BatchableMesh.mjs
var BatchableMesh = __webpack_require__(8734);
;// ./node_modules/pixi.js/lib/scene/mesh/shared/MeshPipe.mjs








"use strict";
class MeshGpuData {
  destroy() {
  }
}
class MeshPipe {
  constructor(renderer, adaptor) {
    this.localUniforms = new UniformGroup/* UniformGroup */.k({
      uTransformMatrix: { value: new Matrix/* Matrix */.u(), type: "mat3x3<f32>" },
      uColor: { value: new Float32Array([1, 1, 1, 1]), type: "vec4<f32>" },
      uRound: { value: 0, type: "f32" }
    });
    this.localUniformsBindGroup = new BindGroup/* BindGroup */.T({
      0: this.localUniforms
    });
    this.renderer = renderer;
    this._adaptor = adaptor;
    this._adaptor.init();
  }
  validateRenderable(mesh) {
    const meshData = this._getMeshData(mesh);
    const wasBatched = meshData.batched;
    const isBatched = mesh.batched;
    meshData.batched = isBatched;
    if (wasBatched !== isBatched) {
      return true;
    } else if (isBatched) {
      const geometry = mesh._geometry;
      if (geometry.indices.length !== meshData.indexSize || geometry.positions.length !== meshData.vertexSize) {
        meshData.indexSize = geometry.indices.length;
        meshData.vertexSize = geometry.positions.length;
        return true;
      }
      const batchableMesh = this._getBatchableMesh(mesh);
      if (batchableMesh.texture.uid !== mesh._texture.uid) {
        batchableMesh._textureMatrixUpdateId = -1;
      }
      return !batchableMesh._batcher.checkAndUpdateTexture(
        batchableMesh,
        mesh._texture
      );
    }
    return false;
  }
  addRenderable(mesh, instructionSet) {
    const batcher = this.renderer.renderPipes.batch;
    const meshData = this._getMeshData(mesh);
    if (mesh.didViewUpdate) {
      meshData.indexSize = mesh._geometry.indices?.length;
      meshData.vertexSize = mesh._geometry.positions?.length;
    }
    if (meshData.batched) {
      const gpuBatchableMesh = this._getBatchableMesh(mesh);
      gpuBatchableMesh.setTexture(mesh._texture);
      gpuBatchableMesh.geometry = mesh._geometry;
      batcher.addToBatch(gpuBatchableMesh, instructionSet);
    } else {
      batcher.break(instructionSet);
      instructionSet.add(mesh);
    }
  }
  updateRenderable(mesh) {
    if (mesh.batched) {
      const gpuBatchableMesh = this._getBatchableMesh(mesh);
      gpuBatchableMesh.setTexture(mesh._texture);
      gpuBatchableMesh.geometry = mesh._geometry;
      gpuBatchableMesh._batcher.updateElement(gpuBatchableMesh);
    }
  }
  execute(mesh) {
    if (!mesh.isRenderable)
      return;
    mesh.state.blendMode = (0,getAdjustedBlendModeBlend/* getAdjustedBlendModeBlend */.i)(mesh.groupBlendMode, mesh.texture._source);
    const localUniforms = this.localUniforms;
    localUniforms.uniforms.uTransformMatrix = mesh.groupTransform;
    localUniforms.uniforms.uRound = this.renderer._roundPixels | mesh._roundPixels;
    localUniforms.update();
    (0,colorToUniform/* color32BitToUniform */.V)(
      mesh.groupColorAlpha,
      localUniforms.uniforms.uColor,
      0
    );
    this._adaptor.execute(this, mesh);
  }
  _getMeshData(mesh) {
    var _a, _b;
    (_a = mesh._gpuData)[_b = this.renderer.uid] || (_a[_b] = new MeshGpuData());
    return mesh._gpuData[this.renderer.uid].meshData || this._initMeshData(mesh);
  }
  _initMeshData(mesh) {
    mesh._gpuData[this.renderer.uid].meshData = {
      batched: mesh.batched,
      indexSize: 0,
      vertexSize: 0
    };
    return mesh._gpuData[this.renderer.uid].meshData;
  }
  _getBatchableMesh(mesh) {
    var _a, _b;
    (_a = mesh._gpuData)[_b = this.renderer.uid] || (_a[_b] = new MeshGpuData());
    return mesh._gpuData[this.renderer.uid].batchableMesh || this._initBatchableMesh(mesh);
  }
  _initBatchableMesh(mesh) {
    const gpuMesh = new BatchableMesh/* BatchableMesh */.U();
    gpuMesh.renderable = mesh;
    gpuMesh.setTexture(mesh._texture);
    gpuMesh.transform = mesh.groupTransform;
    gpuMesh.roundPixels = this.renderer._roundPixels | mesh._roundPixels;
    mesh._gpuData[this.renderer.uid].batchableMesh = gpuMesh;
    return gpuMesh;
  }
  destroy() {
    this.localUniforms = null;
    this.localUniformsBindGroup = null;
    this._adaptor.destroy();
    this._adaptor = null;
    this.renderer = null;
  }
}
/** @ignore */
MeshPipe.extension = {
  type: [
    Extensions/* ExtensionType */.Ag.WebGLPipes,
    Extensions/* ExtensionType */.Ag.WebGPUPipes,
    Extensions/* ExtensionType */.Ag.CanvasPipes
  ],
  name: "mesh"
};


//# sourceMappingURL=MeshPipe.mjs.map

;// ./node_modules/pixi.js/lib/scene/mesh/init.mjs



"use strict";
Extensions/* extensions */.XO.add(MeshPipe);
//# sourceMappingURL=init.mjs.map


/***/ },

/***/ 8734
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   U: () => (/* binding */ BatchableMesh)
/* harmony export */ });

class BatchableMesh {
  constructor() {
    this.batcherName = "default";
    this.packAsQuad = false;
    this.indexOffset = 0;
    this.attributeOffset = 0;
    this.roundPixels = 0;
    this._batcher = null;
    this._batch = null;
    this._textureMatrixUpdateId = -1;
    this._uvUpdateId = -1;
  }
  get blendMode() {
    return this.renderable.groupBlendMode;
  }
  get topology() {
    return this._topology || this.geometry.topology;
  }
  set topology(value) {
    this._topology = value;
  }
  reset() {
    this.renderable = null;
    this.texture = null;
    this._batcher = null;
    this._batch = null;
    this.geometry = null;
    this._uvUpdateId = -1;
    this._textureMatrixUpdateId = -1;
  }
  /**
   * Sets the texture for the batchable mesh.
   * As it does so, it resets the texture matrix update ID.
   * this is to ensure that the texture matrix is recalculated when the uvs are referenced
   * @param value - The texture to set.
   */
  setTexture(value) {
    if (this.texture === value)
      return;
    this.texture = value;
    this._textureMatrixUpdateId = -1;
  }
  get uvs() {
    const geometry = this.geometry;
    const uvBuffer = geometry.getBuffer("aUV");
    const uvs = uvBuffer.data;
    let transformedUvs = uvs;
    const textureMatrix = this.texture.textureMatrix;
    if (!textureMatrix.isSimple) {
      transformedUvs = this._transformedUvs;
      if (this._textureMatrixUpdateId !== textureMatrix._updateID || this._uvUpdateId !== uvBuffer._updateID) {
        if (!transformedUvs || transformedUvs.length < uvs.length) {
          transformedUvs = this._transformedUvs = new Float32Array(uvs.length);
        }
        this._textureMatrixUpdateId = textureMatrix._updateID;
        this._uvUpdateId = uvBuffer._updateID;
        textureMatrix.multiplyUvs(uvs, transformedUvs);
      }
    }
    return transformedUvs;
  }
  get positions() {
    return this.geometry.positions;
  }
  get indices() {
    return this.geometry.indices;
  }
  get color() {
    return this.renderable.groupColorAlpha;
  }
  get groupTransform() {
    return this.renderable.groupTransform;
  }
  get attributeSize() {
    return this.geometry.positions.length / 2;
  }
  get indexSize() {
    return this.geometry.indices.length;
  }
}


//# sourceMappingURL=BatchableMesh.mjs.map


/***/ },

/***/ 4382
(__unused_webpack___webpack_module__, __unused_webpack___webpack_exports__, __webpack_require__) {

"use strict";

// EXTERNAL MODULE: ./node_modules/pixi.js/lib/extensions/Extensions.mjs
var Extensions = __webpack_require__(8507);
;// ./node_modules/pixi.js/lib/scene/particle-container/gl/GlParticleContainerAdaptor.mjs

class GlParticleContainerAdaptor {
  execute(particleContainerPipe, container) {
    const state = particleContainerPipe.state;
    const renderer = particleContainerPipe.renderer;
    const shader = container.shader || particleContainerPipe.defaultShader;
    shader.resources.uTexture = container.texture._source;
    shader.resources.uniforms = particleContainerPipe.localUniforms;
    const gl = renderer.gl;
    const buffer = particleContainerPipe.getBuffers(container);
    renderer.shader.bind(shader);
    renderer.state.set(state);
    renderer.geometry.bind(buffer.geometry, shader.glProgram);
    const byteSize = buffer.geometry.indexBuffer.data.BYTES_PER_ELEMENT;
    const glType = byteSize === 2 ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT;
    gl.drawElements(gl.TRIANGLES, container.particleChildren.length * 6, glType, 0);
  }
}


//# sourceMappingURL=GlParticleContainerAdaptor.mjs.map

// EXTERNAL MODULE: ./node_modules/pixi.js/lib/maths/matrix/Matrix.mjs
var Matrix = __webpack_require__(9313);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/shader/UniformGroup.mjs + 2 modules
var UniformGroup = __webpack_require__(1911);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/state/getAdjustedBlendModeBlend.mjs
var getAdjustedBlendModeBlend = __webpack_require__(8639);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/state/State.mjs
var State = __webpack_require__(7547);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/graphics/gpu/colorToUniform.mjs
var colorToUniform = __webpack_require__(2760);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/buffer/Buffer.mjs
var Buffer = __webpack_require__(949);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/buffer/const.mjs
var buffer_const = __webpack_require__(1132);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/geometry/Geometry.mjs + 2 modules
var Geometry = __webpack_require__(1729);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/geometry/utils/getAttributeInfoFromFormat.mjs
var getAttributeInfoFromFormat = __webpack_require__(8306);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/utils/data/ViewableBuffer.mjs
var ViewableBuffer = __webpack_require__(1460);
;// ./node_modules/pixi.js/lib/scene/particle-container/shared/utils/createIndicesForQuads.mjs

function createIndicesForQuads(size, outBuffer = null) {
  const totalIndices = size * 6;
  if (totalIndices > 65535) {
    outBuffer || (outBuffer = new Uint32Array(totalIndices));
  } else {
    outBuffer || (outBuffer = new Uint16Array(totalIndices));
  }
  if (outBuffer.length !== totalIndices) {
    throw new Error(`Out buffer length is incorrect, got ${outBuffer.length} and expected ${totalIndices}`);
  }
  for (let i = 0, j = 0; i < totalIndices; i += 6, j += 4) {
    outBuffer[i + 0] = j + 0;
    outBuffer[i + 1] = j + 1;
    outBuffer[i + 2] = j + 2;
    outBuffer[i + 3] = j + 0;
    outBuffer[i + 4] = j + 2;
    outBuffer[i + 5] = j + 3;
  }
  return outBuffer;
}


//# sourceMappingURL=createIndicesForQuads.mjs.map

;// ./node_modules/pixi.js/lib/scene/particle-container/shared/utils/generateParticleUpdateFunction.mjs


"use strict";
function generateParticleUpdateFunction(properties) {
  return {
    dynamicUpdate: generateUpdateFunction(properties, true),
    staticUpdate: generateUpdateFunction(properties, false)
  };
}
function generateUpdateFunction(properties, dynamic) {
  const funcFragments = [];
  funcFragments.push(`

        var index = 0;

        for (let i = 0; i < ps.length; ++i)
        {
            const p = ps[i];

            `);
  let offset = 0;
  for (const i in properties) {
    const property = properties[i];
    if (dynamic !== property.dynamic)
      continue;
    funcFragments.push(`offset = index + ${offset}`);
    funcFragments.push(property.code);
    const attributeInfo = (0,getAttributeInfoFromFormat/* getAttributeInfoFromFormat */.m)(property.format);
    offset += attributeInfo.stride / 4;
  }
  funcFragments.push(`
            index += stride * 4;
        }
    `);
  funcFragments.unshift(`
        var stride = ${offset};
    `);
  const functionSource = funcFragments.join("\n");
  return new Function("ps", "f32v", "u32v", functionSource);
}


//# sourceMappingURL=generateParticleUpdateFunction.mjs.map

;// ./node_modules/pixi.js/lib/scene/particle-container/shared/ParticleBuffer.mjs








"use strict";
class ParticleBuffer {
  constructor(options) {
    this._size = 0;
    this._generateParticleUpdateCache = {};
    const size = this._size = options.size ?? 1e3;
    const properties = options.properties;
    let staticVertexSize = 0;
    let dynamicVertexSize = 0;
    for (const i in properties) {
      const property = properties[i];
      const attributeInfo = (0,getAttributeInfoFromFormat/* getAttributeInfoFromFormat */.m)(property.format);
      if (property.dynamic) {
        dynamicVertexSize += attributeInfo.stride;
      } else {
        staticVertexSize += attributeInfo.stride;
      }
    }
    this._dynamicStride = dynamicVertexSize / 4;
    this._staticStride = staticVertexSize / 4;
    this.staticAttributeBuffer = new ViewableBuffer/* ViewableBuffer */.u(size * 4 * staticVertexSize);
    this.dynamicAttributeBuffer = new ViewableBuffer/* ViewableBuffer */.u(size * 4 * dynamicVertexSize);
    this.indexBuffer = createIndicesForQuads(size);
    const geometry = new Geometry/* Geometry */.V();
    let dynamicOffset = 0;
    let staticOffset = 0;
    this._staticBuffer = new Buffer/* Buffer */.h({
      data: new Float32Array(1),
      label: "static-particle-buffer",
      shrinkToFit: false,
      usage: buffer_const/* BufferUsage */.S.VERTEX | buffer_const/* BufferUsage */.S.COPY_DST
    });
    this._dynamicBuffer = new Buffer/* Buffer */.h({
      data: new Float32Array(1),
      label: "dynamic-particle-buffer",
      shrinkToFit: false,
      usage: buffer_const/* BufferUsage */.S.VERTEX | buffer_const/* BufferUsage */.S.COPY_DST
    });
    for (const i in properties) {
      const property = properties[i];
      const attributeInfo = (0,getAttributeInfoFromFormat/* getAttributeInfoFromFormat */.m)(property.format);
      if (property.dynamic) {
        geometry.addAttribute(property.attributeName, {
          buffer: this._dynamicBuffer,
          stride: this._dynamicStride * 4,
          offset: dynamicOffset * 4,
          format: property.format
        });
        dynamicOffset += attributeInfo.size;
      } else {
        geometry.addAttribute(property.attributeName, {
          buffer: this._staticBuffer,
          stride: this._staticStride * 4,
          offset: staticOffset * 4,
          format: property.format
        });
        staticOffset += attributeInfo.size;
      }
    }
    geometry.addIndex(this.indexBuffer);
    const uploadFunction = this.getParticleUpdate(properties);
    this._dynamicUpload = uploadFunction.dynamicUpdate;
    this._staticUpload = uploadFunction.staticUpdate;
    this.geometry = geometry;
  }
  getParticleUpdate(properties) {
    const key = getParticleSyncKey(properties);
    if (this._generateParticleUpdateCache[key]) {
      return this._generateParticleUpdateCache[key];
    }
    this._generateParticleUpdateCache[key] = this.generateParticleUpdate(properties);
    return this._generateParticleUpdateCache[key];
  }
  generateParticleUpdate(properties) {
    return generateParticleUpdateFunction(properties);
  }
  update(particles, uploadStatic) {
    if (particles.length > this._size) {
      uploadStatic = true;
      this._size = Math.max(particles.length, this._size * 1.5 | 0);
      this.staticAttributeBuffer = new ViewableBuffer/* ViewableBuffer */.u(this._size * this._staticStride * 4 * 4);
      this.dynamicAttributeBuffer = new ViewableBuffer/* ViewableBuffer */.u(this._size * this._dynamicStride * 4 * 4);
      this.indexBuffer = createIndicesForQuads(this._size);
      this.geometry.indexBuffer.setDataWithSize(
        this.indexBuffer,
        this.indexBuffer.byteLength,
        true
      );
    }
    const dynamicAttributeBuffer = this.dynamicAttributeBuffer;
    this._dynamicUpload(particles, dynamicAttributeBuffer.float32View, dynamicAttributeBuffer.uint32View);
    this._dynamicBuffer.setDataWithSize(
      this.dynamicAttributeBuffer.float32View,
      particles.length * this._dynamicStride * 4,
      true
    );
    if (uploadStatic) {
      const staticAttributeBuffer = this.staticAttributeBuffer;
      this._staticUpload(particles, staticAttributeBuffer.float32View, staticAttributeBuffer.uint32View);
      this._staticBuffer.setDataWithSize(
        staticAttributeBuffer.float32View,
        particles.length * this._staticStride * 4,
        true
      );
    }
  }
  destroy() {
    this._staticBuffer.destroy();
    this._dynamicBuffer.destroy();
    this.geometry.destroy();
  }
}
function getParticleSyncKey(properties) {
  const keyGen = [];
  for (const key in properties) {
    const property = properties[key];
    keyGen.push(key, property.code, property.dynamic ? "d" : "s");
  }
  return keyGen.join("_");
}


//# sourceMappingURL=ParticleBuffer.mjs.map

// EXTERNAL MODULE: ./node_modules/pixi.js/lib/color/Color.mjs + 2 modules
var Color = __webpack_require__(3556);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/gl/shader/GlProgram.mjs + 6 modules
var GlProgram = __webpack_require__(2112);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/gpu/shader/GpuProgram.mjs + 6 modules
var GpuProgram = __webpack_require__(9080);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/shader/Shader.mjs
var Shader = __webpack_require__(8475);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/texture/Texture.mjs + 2 modules
var Texture = __webpack_require__(226);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/texture/TextureStyle.mjs
var TextureStyle = __webpack_require__(218);
;// ./node_modules/pixi.js/lib/scene/particle-container/shared/shader/particles.frag.mjs
var fragment = "varying vec2 vUV;\nvarying vec4 vColor;\n\nuniform sampler2D uTexture;\n\nvoid main(void){\n    vec4 color = texture2D(uTexture, vUV) * vColor;\n    gl_FragColor = color;\n}";


//# sourceMappingURL=particles.frag.mjs.map

;// ./node_modules/pixi.js/lib/scene/particle-container/shared/shader/particles.vert.mjs
var vertex = "attribute vec2 aVertex;\nattribute vec2 aUV;\nattribute vec4 aColor;\n\nattribute vec2 aPosition;\nattribute float aRotation;\n\nuniform mat3 uTranslationMatrix;\nuniform float uRound;\nuniform vec2 uResolution;\nuniform vec4 uColor;\n\nvarying vec2 vUV;\nvarying vec4 vColor;\n\nvec2 roundPixels(vec2 position, vec2 targetSize)\n{       \n    return (floor(((position * 0.5 + 0.5) * targetSize) + 0.5) / targetSize) * 2.0 - 1.0;\n}\n\nvoid main(void){\n    float cosRotation = cos(aRotation);\n    float sinRotation = sin(aRotation);\n    float x = aVertex.x * cosRotation - aVertex.y * sinRotation;\n    float y = aVertex.x * sinRotation + aVertex.y * cosRotation;\n\n    vec2 v = vec2(x, y);\n    v = v + aPosition;\n\n    gl_Position = vec4((uTranslationMatrix * vec3(v, 1.0)).xy, 0.0, 1.0);\n\n    if(uRound == 1.0)\n    {\n        gl_Position.xy = roundPixels(gl_Position.xy, uResolution);\n    }\n\n    vUV = aUV;\n    vColor = vec4(aColor.rgb * aColor.a, aColor.a) * uColor;\n}\n";


//# sourceMappingURL=particles.vert.mjs.map

;// ./node_modules/pixi.js/lib/scene/particle-container/shared/shader/particles.wgsl.mjs
var wgsl = "\nstruct ParticleUniforms {\n  uTranslationMatrix:mat3x3<f32>,\n  uColor:vec4<f32>,\n  uRound:f32,\n  uResolution:vec2<f32>,\n};\n\nfn roundPixels(position: vec2<f32>, targetSize: vec2<f32>) -> vec2<f32>\n{\n  return (floor(((position * 0.5 + 0.5) * targetSize) + 0.5) / targetSize) * 2.0 - 1.0;\n}\n\n@group(0) @binding(0) var<uniform> uniforms: ParticleUniforms;\n\n@group(1) @binding(0) var uTexture: texture_2d<f32>;\n@group(1) @binding(1) var uSampler : sampler;\n\nstruct VSOutput {\n    @builtin(position) position: vec4<f32>,\n    @location(0) uv : vec2<f32>,\n    @location(1) color : vec4<f32>,\n  };\n@vertex\nfn mainVertex(\n  @location(0) aVertex: vec2<f32>,\n  @location(1) aPosition: vec2<f32>,\n  @location(2) aUV: vec2<f32>,\n  @location(3) aColor: vec4<f32>,\n  @location(4) aRotation: f32,\n) -> VSOutput {\n  \n   let v = vec2(\n       aVertex.x * cos(aRotation) - aVertex.y * sin(aRotation),\n       aVertex.x * sin(aRotation) + aVertex.y * cos(aRotation)\n   ) + aPosition;\n\n   var position = vec4((uniforms.uTranslationMatrix * vec3(v, 1.0)).xy, 0.0, 1.0);\n\n   if(uniforms.uRound == 1.0) {\n       position = vec4(roundPixels(position.xy, uniforms.uResolution), position.zw);\n   }\n\n    let vColor = vec4(aColor.rgb * aColor.a, aColor.a) * uniforms.uColor;\n\n  return VSOutput(\n   position,\n   aUV,\n   vColor,\n  );\n}\n\n@fragment\nfn mainFragment(\n  @location(0) uv: vec2<f32>,\n  @location(1) color: vec4<f32>,\n  @builtin(position) position: vec4<f32>,\n) -> @location(0) vec4<f32> {\n\n    var sample = textureSample(uTexture, uSampler, uv) * color;\n   \n    return sample;\n}";


//# sourceMappingURL=particles.wgsl.mjs.map

;// ./node_modules/pixi.js/lib/scene/particle-container/shared/shader/ParticleShader.mjs











"use strict";
class ParticleShader extends Shader/* Shader */.M {
  constructor() {
    const glProgram = GlProgram/* GlProgram */.M.from({
      vertex: vertex,
      fragment: fragment
    });
    const gpuProgram = GpuProgram/* GpuProgram */.B.from({
      fragment: {
        source: wgsl,
        entryPoint: "mainFragment"
      },
      vertex: {
        source: wgsl,
        entryPoint: "mainVertex"
      }
    });
    super({
      glProgram,
      gpuProgram,
      resources: {
        // this will be replaced with the texture from the particle container
        uTexture: Texture/* Texture */.g.WHITE.source,
        // this will be replaced with the texture style from the particle container
        uSampler: new TextureStyle/* TextureStyle */.n({}),
        // this will be replaced with the local uniforms from the particle container
        uniforms: {
          uTranslationMatrix: { value: new Matrix/* Matrix */.u(), type: "mat3x3<f32>" },
          uColor: { value: new Color/* Color */.Q(16777215), type: "vec4<f32>" },
          uRound: { value: 1, type: "f32" },
          uResolution: { value: [0, 0], type: "vec2<f32>" }
        }
      }
    });
  }
}


//# sourceMappingURL=ParticleShader.mjs.map

;// ./node_modules/pixi.js/lib/scene/particle-container/shared/ParticleContainerPipe.mjs








"use strict";
class ParticleContainerPipe {
  /**
   * @param renderer - The renderer this sprite batch works for.
   * @param adaptor
   */
  constructor(renderer, adaptor) {
    /** @internal */
    this.state = State/* State */.U.for2d();
    /** Local uniforms that are used for rendering particles. */
    this.localUniforms = new UniformGroup/* UniformGroup */.k({
      uTranslationMatrix: { value: new Matrix/* Matrix */.u(), type: "mat3x3<f32>" },
      uColor: { value: new Float32Array(4), type: "vec4<f32>" },
      uRound: { value: 1, type: "f32" },
      uResolution: { value: [0, 0], type: "vec2<f32>" }
    });
    this.renderer = renderer;
    this.adaptor = adaptor;
    this.defaultShader = new ParticleShader();
    this.state = State/* State */.U.for2d();
  }
  validateRenderable(_renderable) {
    return false;
  }
  addRenderable(renderable, instructionSet) {
    this.renderer.renderPipes.batch.break(instructionSet);
    instructionSet.add(renderable);
  }
  getBuffers(renderable) {
    return renderable._gpuData[this.renderer.uid] || this._initBuffer(renderable);
  }
  _initBuffer(renderable) {
    renderable._gpuData[this.renderer.uid] = new ParticleBuffer({
      size: renderable.particleChildren.length,
      properties: renderable._properties
    });
    return renderable._gpuData[this.renderer.uid];
  }
  updateRenderable(_renderable) {
  }
  execute(container) {
    const children = container.particleChildren;
    if (children.length === 0) {
      return;
    }
    const renderer = this.renderer;
    const buffer = this.getBuffers(container);
    container.texture || (container.texture = children[0].texture);
    const state = this.state;
    buffer.update(children, container._childrenDirty);
    container._childrenDirty = false;
    state.blendMode = (0,getAdjustedBlendModeBlend/* getAdjustedBlendModeBlend */.i)(container.blendMode, container.texture._source);
    const uniforms = this.localUniforms.uniforms;
    const transformationMatrix = uniforms.uTranslationMatrix;
    container.worldTransform.copyTo(transformationMatrix);
    transformationMatrix.prepend(renderer.globalUniforms.globalUniformData.projectionMatrix);
    uniforms.uResolution = renderer.globalUniforms.globalUniformData.resolution;
    uniforms.uRound = renderer._roundPixels | container._roundPixels;
    (0,colorToUniform/* color32BitToUniform */.V)(
      container.groupColorAlpha,
      uniforms.uColor,
      0
    );
    this.adaptor.execute(this, container);
  }
  /** Destroys the ParticleRenderer. */
  destroy() {
    this.renderer = null;
    if (this.defaultShader) {
      this.defaultShader.destroy();
      this.defaultShader = null;
    }
  }
}


//# sourceMappingURL=ParticleContainerPipe.mjs.map

;// ./node_modules/pixi.js/lib/scene/particle-container/shared/GlParticleContainerPipe.mjs




"use strict";
class GlParticleContainerPipe extends ParticleContainerPipe {
  constructor(renderer) {
    super(renderer, new GlParticleContainerAdaptor());
  }
}
/** @ignore */
GlParticleContainerPipe.extension = {
  type: [
    Extensions/* ExtensionType */.Ag.WebGLPipes
  ],
  name: "particle"
};


//# sourceMappingURL=GlParticleContainerPipe.mjs.map

;// ./node_modules/pixi.js/lib/scene/particle-container/gpu/GpuParticleContainerAdaptor.mjs

class GpuParticleContainerAdaptor {
  execute(particleContainerPipe, container) {
    const renderer = particleContainerPipe.renderer;
    const shader = container.shader || particleContainerPipe.defaultShader;
    shader.groups[0] = renderer.renderPipes.uniformBatch.getUniformBindGroup(particleContainerPipe.localUniforms, true);
    shader.groups[1] = renderer.texture.getTextureBindGroup(container.texture);
    const state = particleContainerPipe.state;
    const buffer = particleContainerPipe.getBuffers(container);
    renderer.encoder.draw({
      geometry: buffer.geometry,
      shader: container.shader || particleContainerPipe.defaultShader,
      state,
      size: container.particleChildren.length * 6
    });
  }
}


//# sourceMappingURL=GpuParticleContainerAdaptor.mjs.map

;// ./node_modules/pixi.js/lib/scene/particle-container/shared/GpuParticleContainerPipe.mjs




"use strict";
class GpuParticleContainerPipe extends ParticleContainerPipe {
  constructor(renderer) {
    super(renderer, new GpuParticleContainerAdaptor());
  }
}
/** @ignore */
GpuParticleContainerPipe.extension = {
  type: [
    Extensions/* ExtensionType */.Ag.WebGPUPipes
  ],
  name: "particle"
};


//# sourceMappingURL=GpuParticleContainerPipe.mjs.map

;// ./node_modules/pixi.js/lib/scene/particle-container/init.mjs




"use strict";
Extensions/* extensions */.XO.add(GlParticleContainerPipe);
Extensions/* extensions */.XO.add(GpuParticleContainerPipe);
//# sourceMappingURL=init.mjs.map


/***/ },

/***/ 8642
(__unused_webpack___webpack_module__, __unused_webpack___webpack_exports__, __webpack_require__) {

"use strict";

// EXTERNAL MODULE: ./node_modules/pixi.js/lib/extensions/Extensions.mjs
var Extensions = __webpack_require__(8507);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/mesh/shared/BatchableMesh.mjs
var BatchableMesh = __webpack_require__(8734);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/utils/logging/deprecation.mjs
var deprecation = __webpack_require__(4670);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/mesh/shared/MeshGeometry.mjs
var MeshGeometry = __webpack_require__(5060);
;// ./node_modules/pixi.js/lib/scene/mesh-plane/PlaneGeometry.mjs



"use strict";
const _PlaneGeometry = class _PlaneGeometry extends MeshGeometry/* MeshGeometry */.u {
  constructor(...args) {
    super({});
    let options = args[0] ?? {};
    if (typeof options === "number") {
      (0,deprecation/* deprecation */.t6)(deprecation/* v8_0_0 */.lj, "PlaneGeometry constructor changed please use { width, height, verticesX, verticesY } instead");
      options = {
        width: options,
        height: args[1],
        verticesX: args[2],
        verticesY: args[3]
      };
    }
    this.build(options);
  }
  /**
   * Refreshes plane coordinates
   * @param options - Options to be applied to plane geometry
   */
  build(options) {
    options = { ..._PlaneGeometry.defaultOptions, ...options };
    this.verticesX = this.verticesX ?? options.verticesX;
    this.verticesY = this.verticesY ?? options.verticesY;
    this.width = this.width ?? options.width;
    this.height = this.height ?? options.height;
    const total = this.verticesX * this.verticesY;
    const verts = [];
    const uvs = [];
    const indices = [];
    const verticesX = this.verticesX - 1;
    const verticesY = this.verticesY - 1;
    const sizeX = this.width / verticesX;
    const sizeY = this.height / verticesY;
    for (let i = 0; i < total; i++) {
      const x = i % this.verticesX;
      const y = i / this.verticesX | 0;
      verts.push(x * sizeX, y * sizeY);
      uvs.push(x / verticesX, y / verticesY);
    }
    const totalSub = verticesX * verticesY;
    for (let i = 0; i < totalSub; i++) {
      const xpos = i % verticesX;
      const ypos = i / verticesX | 0;
      const value = ypos * this.verticesX + xpos;
      const value2 = ypos * this.verticesX + xpos + 1;
      const value3 = (ypos + 1) * this.verticesX + xpos;
      const value4 = (ypos + 1) * this.verticesX + xpos + 1;
      indices.push(
        value,
        value2,
        value3,
        value2,
        value4,
        value3
      );
    }
    this.buffers[0].data = new Float32Array(verts);
    this.buffers[1].data = new Float32Array(uvs);
    this.indexBuffer.data = new Uint32Array(indices);
    this.buffers[0].update();
    this.buffers[1].update();
    this.indexBuffer.update();
  }
};
_PlaneGeometry.defaultOptions = {
  width: 100,
  height: 100,
  verticesX: 10,
  verticesY: 10
};
let PlaneGeometry = _PlaneGeometry;


//# sourceMappingURL=PlaneGeometry.mjs.map

;// ./node_modules/pixi.js/lib/scene/sprite-nine-slice/NineSliceGeometry.mjs


"use strict";
const _NineSliceGeometry = class _NineSliceGeometry extends PlaneGeometry {
  constructor(options = {}) {
    options = { ..._NineSliceGeometry.defaultOptions, ...options };
    super({
      width: options.width,
      height: options.height,
      verticesX: 4,
      verticesY: 4
    });
    this.update(options);
  }
  /**
   * Updates the NineSliceGeometry with the options.
   * @param options - The options of the NineSliceGeometry.
   */
  update(options) {
    this.width = options.width ?? this.width;
    this.height = options.height ?? this.height;
    this._originalWidth = options.originalWidth ?? this._originalWidth;
    this._originalHeight = options.originalHeight ?? this._originalHeight;
    this._leftWidth = options.leftWidth ?? this._leftWidth;
    this._rightWidth = options.rightWidth ?? this._rightWidth;
    this._topHeight = options.topHeight ?? this._topHeight;
    this._bottomHeight = options.bottomHeight ?? this._bottomHeight;
    this._anchorX = options.anchor?.x;
    this._anchorY = options.anchor?.y;
    this.updateUvs();
    this.updatePositions();
  }
  /** Updates the positions of the vertices. */
  updatePositions() {
    const p = this.positions;
    const {
      width,
      height,
      _leftWidth,
      _rightWidth,
      _topHeight,
      _bottomHeight,
      _anchorX,
      _anchorY
    } = this;
    const w = _leftWidth + _rightWidth;
    const scaleW = width > w ? 1 : width / w;
    const h = _topHeight + _bottomHeight;
    const scaleH = height > h ? 1 : height / h;
    const scale = Math.min(scaleW, scaleH);
    const anchorOffsetX = _anchorX * width;
    const anchorOffsetY = _anchorY * height;
    p[0] = p[8] = p[16] = p[24] = -anchorOffsetX;
    p[2] = p[10] = p[18] = p[26] = _leftWidth * scale - anchorOffsetX;
    p[4] = p[12] = p[20] = p[28] = width - _rightWidth * scale - anchorOffsetX;
    p[6] = p[14] = p[22] = p[30] = width - anchorOffsetX;
    p[1] = p[3] = p[5] = p[7] = -anchorOffsetY;
    p[9] = p[11] = p[13] = p[15] = _topHeight * scale - anchorOffsetY;
    p[17] = p[19] = p[21] = p[23] = height - _bottomHeight * scale - anchorOffsetY;
    p[25] = p[27] = p[29] = p[31] = height - anchorOffsetY;
    this.getBuffer("aPosition").update();
  }
  /** Updates the UVs of the vertices. */
  updateUvs() {
    const uvs = this.uvs;
    uvs[0] = uvs[8] = uvs[16] = uvs[24] = 0;
    uvs[1] = uvs[3] = uvs[5] = uvs[7] = 0;
    uvs[6] = uvs[14] = uvs[22] = uvs[30] = 1;
    uvs[25] = uvs[27] = uvs[29] = uvs[31] = 1;
    const _uvw = 1 / this._originalWidth;
    const _uvh = 1 / this._originalHeight;
    uvs[2] = uvs[10] = uvs[18] = uvs[26] = _uvw * this._leftWidth;
    uvs[9] = uvs[11] = uvs[13] = uvs[15] = _uvh * this._topHeight;
    uvs[4] = uvs[12] = uvs[20] = uvs[28] = 1 - _uvw * this._rightWidth;
    uvs[17] = uvs[19] = uvs[21] = uvs[23] = 1 - _uvh * this._bottomHeight;
    this.getBuffer("aUV").update();
  }
};
/** The default options for the NineSliceGeometry. */
_NineSliceGeometry.defaultOptions = {
  /** The width of the NineSlicePlane, setting this will actually modify the vertices and UV's of this plane. */
  width: 100,
  /** The height of the NineSlicePlane, setting this will actually modify the vertices and UV's of this plane. */
  height: 100,
  /** The width of the left column. */
  leftWidth: 10,
  /** The height of the top row. */
  topHeight: 10,
  /** The width of the right column. */
  rightWidth: 10,
  /** The height of the bottom row. */
  bottomHeight: 10,
  /** The original width of the texture */
  originalWidth: 100,
  /** The original height of the texture */
  originalHeight: 100
};
let NineSliceGeometry = _NineSliceGeometry;


//# sourceMappingURL=NineSliceGeometry.mjs.map

;// ./node_modules/pixi.js/lib/scene/sprite-nine-slice/NineSliceSpritePipe.mjs




"use strict";
class NineSliceSpriteGpuData extends BatchableMesh/* BatchableMesh */.U {
  constructor() {
    super();
    this.geometry = new NineSliceGeometry();
  }
  destroy() {
    this.geometry.destroy();
  }
}
class NineSliceSpritePipe {
  constructor(renderer) {
    this._renderer = renderer;
  }
  addRenderable(sprite, instructionSet) {
    const gpuSprite = this._getGpuSprite(sprite);
    if (sprite.didViewUpdate)
      this._updateBatchableSprite(sprite, gpuSprite);
    this._renderer.renderPipes.batch.addToBatch(gpuSprite, instructionSet);
  }
  updateRenderable(sprite) {
    const gpuSprite = this._getGpuSprite(sprite);
    if (sprite.didViewUpdate)
      this._updateBatchableSprite(sprite, gpuSprite);
    gpuSprite._batcher.updateElement(gpuSprite);
  }
  validateRenderable(sprite) {
    const gpuSprite = this._getGpuSprite(sprite);
    return !gpuSprite._batcher.checkAndUpdateTexture(
      gpuSprite,
      sprite._texture
    );
  }
  _updateBatchableSprite(sprite, batchableSprite) {
    batchableSprite.geometry.update(sprite);
    batchableSprite.setTexture(sprite._texture);
  }
  _getGpuSprite(sprite) {
    return sprite._gpuData[this._renderer.uid] || this._initGPUSprite(sprite);
  }
  _initGPUSprite(sprite) {
    const gpuData = sprite._gpuData[this._renderer.uid] = new NineSliceSpriteGpuData();
    const batchableMesh = gpuData;
    batchableMesh.renderable = sprite;
    batchableMesh.transform = sprite.groupTransform;
    batchableMesh.texture = sprite._texture;
    batchableMesh.roundPixels = this._renderer._roundPixels | sprite._roundPixels;
    if (!sprite.didViewUpdate) {
      this._updateBatchableSprite(sprite, batchableMesh);
    }
    return gpuData;
  }
  destroy() {
    this._renderer = null;
  }
}
/** @ignore */
NineSliceSpritePipe.extension = {
  type: [
    Extensions/* ExtensionType */.Ag.WebGLPipes,
    Extensions/* ExtensionType */.Ag.WebGPUPipes,
    Extensions/* ExtensionType */.Ag.CanvasPipes
  ],
  name: "nineSliceSprite"
};


//# sourceMappingURL=NineSliceSpritePipe.mjs.map

;// ./node_modules/pixi.js/lib/scene/sprite-nine-slice/init.mjs



"use strict";
Extensions/* extensions */.XO.add(NineSliceSpritePipe);
//# sourceMappingURL=init.mjs.map


/***/ },

/***/ 8084
(__unused_webpack___webpack_module__, __unused_webpack___webpack_exports__, __webpack_require__) {

"use strict";

// EXTERNAL MODULE: ./node_modules/pixi.js/lib/extensions/Extensions.mjs
var Extensions = __webpack_require__(8507);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/state/getAdjustedBlendModeBlend.mjs
var getAdjustedBlendModeBlend = __webpack_require__(8639);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/state/State.mjs
var State = __webpack_require__(7547);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/types.mjs
var types = __webpack_require__(5099);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/graphics/gpu/colorToUniform.mjs
var colorToUniform = __webpack_require__(2760);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/mesh/shared/BatchableMesh.mjs
var BatchableMesh = __webpack_require__(8734);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/mesh/shared/MeshGeometry.mjs
var MeshGeometry = __webpack_require__(5060);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/maths/matrix/Matrix.mjs
var Matrix = __webpack_require__(9313);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/high-shader/compileHighShaderToProgram.mjs + 8 modules
var compileHighShaderToProgram = __webpack_require__(7714);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/high-shader/shader-bits/localUniformBit.mjs
var localUniformBit = __webpack_require__(2067);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/high-shader/shader-bits/roundPixelsBit.mjs
var roundPixelsBit = __webpack_require__(6665);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/shader/Shader.mjs
var Shader = __webpack_require__(8475);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/shader/UniformGroup.mjs + 2 modules
var UniformGroup = __webpack_require__(1911);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/texture/Texture.mjs + 2 modules
var Texture = __webpack_require__(226);
;// ./node_modules/pixi.js/lib/scene/sprite-tiling/shader/tilingBit.mjs

const tilingBit = {
  name: "tiling-bit",
  vertex: {
    header: (
      /* wgsl */
      `
            struct TilingUniforms {
                uMapCoord:mat3x3<f32>,
                uClampFrame:vec4<f32>,
                uClampOffset:vec2<f32>,
                uTextureTransform:mat3x3<f32>,
                uSizeAnchor:vec4<f32>
            };

            @group(2) @binding(0) var<uniform> tilingUniforms: TilingUniforms;
            @group(2) @binding(1) var uTexture: texture_2d<f32>;
            @group(2) @binding(2) var uSampler: sampler;
        `
    ),
    main: (
      /* wgsl */
      `
            uv = (tilingUniforms.uTextureTransform * vec3(uv, 1.0)).xy;

            position = (position - tilingUniforms.uSizeAnchor.zw) * tilingUniforms.uSizeAnchor.xy;
        `
    )
  },
  fragment: {
    header: (
      /* wgsl */
      `
            struct TilingUniforms {
                uMapCoord:mat3x3<f32>,
                uClampFrame:vec4<f32>,
                uClampOffset:vec2<f32>,
                uTextureTransform:mat3x3<f32>,
                uSizeAnchor:vec4<f32>
            };

            @group(2) @binding(0) var<uniform> tilingUniforms: TilingUniforms;
            @group(2) @binding(1) var uTexture: texture_2d<f32>;
            @group(2) @binding(2) var uSampler: sampler;
        `
    ),
    main: (
      /* wgsl */
      `

            var coord = vUV + ceil(tilingUniforms.uClampOffset - vUV);
            coord = (tilingUniforms.uMapCoord * vec3(coord, 1.0)).xy;
            var unclamped = coord;
            coord = clamp(coord, tilingUniforms.uClampFrame.xy, tilingUniforms.uClampFrame.zw);

            var bias = 0.;

            if(unclamped.x == coord.x && unclamped.y == coord.y)
            {
                bias = -32.;
            }

            outColor = textureSampleBias(uTexture, uSampler, coord, bias);
        `
    )
  }
};
const tilingBitGl = {
  name: "tiling-bit",
  vertex: {
    header: (
      /* glsl */
      `
            uniform mat3 uTextureTransform;
            uniform vec4 uSizeAnchor;

        `
    ),
    main: (
      /* glsl */
      `
            uv = (uTextureTransform * vec3(aUV, 1.0)).xy;

            position = (position - uSizeAnchor.zw) * uSizeAnchor.xy;
        `
    )
  },
  fragment: {
    header: (
      /* glsl */
      `
            uniform sampler2D uTexture;
            uniform mat3 uMapCoord;
            uniform vec4 uClampFrame;
            uniform vec2 uClampOffset;
        `
    ),
    main: (
      /* glsl */
      `

        vec2 coord = vUV + ceil(uClampOffset - vUV);
        coord = (uMapCoord * vec3(coord, 1.0)).xy;
        vec2 unclamped = coord;
        coord = clamp(coord, uClampFrame.xy, uClampFrame.zw);

        outColor = texture(uTexture, coord, unclamped == coord ? 0.0 : -32.0);// lod-bias very negative to force lod 0

        `
    )
  }
};


//# sourceMappingURL=tilingBit.mjs.map

;// ./node_modules/pixi.js/lib/scene/sprite-tiling/shader/TilingSpriteShader.mjs









"use strict";
let gpuProgram;
let glProgram;
class TilingSpriteShader extends Shader/* Shader */.M {
  constructor() {
    gpuProgram ?? (gpuProgram = (0,compileHighShaderToProgram/* compileHighShaderGpuProgram */.v)({
      name: "tiling-sprite-shader",
      bits: [
        localUniformBit/* localUniformBit */.Ls,
        tilingBit,
        roundPixelsBit/* roundPixelsBit */.b
      ]
    }));
    glProgram ?? (glProgram = (0,compileHighShaderToProgram/* compileHighShaderGlProgram */.I)({
      name: "tiling-sprite-shader",
      bits: [
        localUniformBit/* localUniformBitGl */.mA,
        tilingBitGl,
        roundPixelsBit/* roundPixelsBitGl */.m
      ]
    }));
    const tilingUniforms = new UniformGroup/* UniformGroup */.k({
      uMapCoord: { value: new Matrix/* Matrix */.u(), type: "mat3x3<f32>" },
      uClampFrame: { value: new Float32Array([0, 0, 1, 1]), type: "vec4<f32>" },
      uClampOffset: { value: new Float32Array([0, 0]), type: "vec2<f32>" },
      uTextureTransform: { value: new Matrix/* Matrix */.u(), type: "mat3x3<f32>" },
      uSizeAnchor: { value: new Float32Array([100, 100, 0.5, 0.5]), type: "vec4<f32>" }
    });
    super({
      glProgram,
      gpuProgram,
      resources: {
        localUniforms: new UniformGroup/* UniformGroup */.k({
          uTransformMatrix: { value: new Matrix/* Matrix */.u(), type: "mat3x3<f32>" },
          uColor: { value: new Float32Array([1, 1, 1, 1]), type: "vec4<f32>" },
          uRound: { value: 0, type: "f32" }
        }),
        tilingUniforms,
        uTexture: Texture/* Texture */.g.EMPTY.source,
        uSampler: Texture/* Texture */.g.EMPTY.source.style
      }
    });
  }
  updateUniforms(width, height, matrix, anchorX, anchorY, texture) {
    const tilingUniforms = this.resources.tilingUniforms;
    const textureWidth = texture.width;
    const textureHeight = texture.height;
    const textureMatrix = texture.textureMatrix;
    const uTextureTransform = tilingUniforms.uniforms.uTextureTransform;
    uTextureTransform.set(
      matrix.a * textureWidth / width,
      matrix.b * textureWidth / height,
      matrix.c * textureHeight / width,
      matrix.d * textureHeight / height,
      matrix.tx / width,
      matrix.ty / height
    );
    uTextureTransform.invert();
    tilingUniforms.uniforms.uMapCoord = textureMatrix.mapCoord;
    tilingUniforms.uniforms.uClampFrame = textureMatrix.uClampFrame;
    tilingUniforms.uniforms.uClampOffset = textureMatrix.uClampOffset;
    tilingUniforms.uniforms.uTextureTransform = uTextureTransform;
    tilingUniforms.uniforms.uSizeAnchor[0] = width;
    tilingUniforms.uniforms.uSizeAnchor[1] = height;
    tilingUniforms.uniforms.uSizeAnchor[2] = anchorX;
    tilingUniforms.uniforms.uSizeAnchor[3] = anchorY;
    if (texture) {
      this.resources.uTexture = texture.source;
      this.resources.uSampler = texture.source.style;
    }
  }
}


//# sourceMappingURL=TilingSpriteShader.mjs.map

;// ./node_modules/pixi.js/lib/scene/sprite-tiling/utils/QuadGeometry.mjs


"use strict";
class QuadGeometry extends MeshGeometry/* MeshGeometry */.u {
  constructor() {
    super({
      positions: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      indices: new Uint32Array([0, 1, 2, 0, 2, 3])
    });
  }
}


//# sourceMappingURL=QuadGeometry.mjs.map

;// ./node_modules/pixi.js/lib/scene/sprite-tiling/utils/setPositions.mjs

function setPositions(tilingSprite, positions) {
  const anchorX = tilingSprite.anchor.x;
  const anchorY = tilingSprite.anchor.y;
  positions[0] = -anchorX * tilingSprite.width;
  positions[1] = -anchorY * tilingSprite.height;
  positions[2] = (1 - anchorX) * tilingSprite.width;
  positions[3] = -anchorY * tilingSprite.height;
  positions[4] = (1 - anchorX) * tilingSprite.width;
  positions[5] = (1 - anchorY) * tilingSprite.height;
  positions[6] = -anchorX * tilingSprite.width;
  positions[7] = (1 - anchorY) * tilingSprite.height;
}


//# sourceMappingURL=setPositions.mjs.map

;// ./node_modules/pixi.js/lib/scene/sprite-tiling/utils/applyMatrix.mjs

function applyMatrix(array, stride, offset, matrix) {
  let index = 0;
  const size = array.length / (stride || 2);
  const a = matrix.a;
  const b = matrix.b;
  const c = matrix.c;
  const d = matrix.d;
  const tx = matrix.tx;
  const ty = matrix.ty;
  offset *= stride;
  while (index < size) {
    const x = array[offset];
    const y = array[offset + 1];
    array[offset] = a * x + c * y + tx;
    array[offset + 1] = b * x + d * y + ty;
    offset += stride;
    index++;
  }
}


//# sourceMappingURL=applyMatrix.mjs.map

;// ./node_modules/pixi.js/lib/scene/sprite-tiling/utils/setUvs.mjs



"use strict";
function setUvs(tilingSprite, uvs) {
  const texture = tilingSprite.texture;
  const width = texture.frame.width;
  const height = texture.frame.height;
  let anchorX = 0;
  let anchorY = 0;
  if (tilingSprite.applyAnchorToTexture) {
    anchorX = tilingSprite.anchor.x;
    anchorY = tilingSprite.anchor.y;
  }
  uvs[0] = uvs[6] = -anchorX;
  uvs[2] = uvs[4] = 1 - anchorX;
  uvs[1] = uvs[3] = -anchorY;
  uvs[5] = uvs[7] = 1 - anchorY;
  const textureMatrix = Matrix/* Matrix */.u.shared;
  textureMatrix.copyFrom(tilingSprite._tileTransform.matrix);
  textureMatrix.tx /= tilingSprite.width;
  textureMatrix.ty /= tilingSprite.height;
  textureMatrix.invert();
  textureMatrix.scale(tilingSprite.width / width, tilingSprite.height / height);
  applyMatrix(uvs, 2, 0, textureMatrix);
}


//# sourceMappingURL=setUvs.mjs.map

;// ./node_modules/pixi.js/lib/scene/sprite-tiling/TilingSpritePipe.mjs












"use strict";
const sharedQuad = new QuadGeometry();
class TilingSpriteGpuData {
  constructor() {
    this.canBatch = true;
    this.geometry = new MeshGeometry/* MeshGeometry */.u({
      indices: sharedQuad.indices.slice(),
      positions: sharedQuad.positions.slice(),
      uvs: sharedQuad.uvs.slice()
    });
  }
  destroy() {
    this.geometry.destroy();
    this.shader?.destroy();
  }
}
class TilingSpritePipe {
  constructor(renderer) {
    this._state = State/* State */.U.default2d;
    this._renderer = renderer;
  }
  validateRenderable(renderable) {
    const tilingSpriteData = this._getTilingSpriteData(renderable);
    const couldBatch = tilingSpriteData.canBatch;
    this._updateCanBatch(renderable);
    const canBatch = tilingSpriteData.canBatch;
    if (canBatch && canBatch === couldBatch) {
      const { batchableMesh } = tilingSpriteData;
      return !batchableMesh._batcher.checkAndUpdateTexture(
        batchableMesh,
        renderable.texture
      );
    }
    return couldBatch !== canBatch;
  }
  addRenderable(tilingSprite, instructionSet) {
    const batcher = this._renderer.renderPipes.batch;
    this._updateCanBatch(tilingSprite);
    const tilingSpriteData = this._getTilingSpriteData(tilingSprite);
    const { geometry, canBatch } = tilingSpriteData;
    if (canBatch) {
      tilingSpriteData.batchableMesh || (tilingSpriteData.batchableMesh = new BatchableMesh/* BatchableMesh */.U());
      const batchableMesh = tilingSpriteData.batchableMesh;
      if (tilingSprite.didViewUpdate) {
        this._updateBatchableMesh(tilingSprite);
        batchableMesh.geometry = geometry;
        batchableMesh.renderable = tilingSprite;
        batchableMesh.transform = tilingSprite.groupTransform;
        batchableMesh.setTexture(tilingSprite._texture);
      }
      batchableMesh.roundPixels = this._renderer._roundPixels | tilingSprite._roundPixels;
      batcher.addToBatch(batchableMesh, instructionSet);
    } else {
      batcher.break(instructionSet);
      tilingSpriteData.shader || (tilingSpriteData.shader = new TilingSpriteShader());
      this.updateRenderable(tilingSprite);
      instructionSet.add(tilingSprite);
    }
  }
  execute(tilingSprite) {
    const { shader } = this._getTilingSpriteData(tilingSprite);
    shader.groups[0] = this._renderer.globalUniforms.bindGroup;
    const localUniforms = shader.resources.localUniforms.uniforms;
    localUniforms.uTransformMatrix = tilingSprite.groupTransform;
    localUniforms.uRound = this._renderer._roundPixels | tilingSprite._roundPixels;
    (0,colorToUniform/* color32BitToUniform */.V)(
      tilingSprite.groupColorAlpha,
      localUniforms.uColor,
      0
    );
    this._state.blendMode = (0,getAdjustedBlendModeBlend/* getAdjustedBlendModeBlend */.i)(tilingSprite.groupBlendMode, tilingSprite.texture._source);
    this._renderer.encoder.draw({
      geometry: sharedQuad,
      shader,
      state: this._state
    });
  }
  updateRenderable(tilingSprite) {
    const tilingSpriteData = this._getTilingSpriteData(tilingSprite);
    const { canBatch } = tilingSpriteData;
    if (canBatch) {
      const { batchableMesh } = tilingSpriteData;
      if (tilingSprite.didViewUpdate)
        this._updateBatchableMesh(tilingSprite);
      batchableMesh._batcher.updateElement(batchableMesh);
    } else if (tilingSprite.didViewUpdate) {
      const { shader } = tilingSpriteData;
      shader.updateUniforms(
        tilingSprite.width,
        tilingSprite.height,
        tilingSprite._tileTransform.matrix,
        tilingSprite.anchor.x,
        tilingSprite.anchor.y,
        tilingSprite.texture
      );
    }
  }
  _getTilingSpriteData(renderable) {
    return renderable._gpuData[this._renderer.uid] || this._initTilingSpriteData(renderable);
  }
  _initTilingSpriteData(tilingSprite) {
    const gpuData = new TilingSpriteGpuData();
    gpuData.renderable = tilingSprite;
    tilingSprite._gpuData[this._renderer.uid] = gpuData;
    return gpuData;
  }
  _updateBatchableMesh(tilingSprite) {
    const renderableData = this._getTilingSpriteData(tilingSprite);
    const { geometry } = renderableData;
    const style = tilingSprite.texture.source.style;
    if (style.addressMode !== "repeat") {
      style.addressMode = "repeat";
      style.update();
    }
    setUvs(tilingSprite, geometry.uvs);
    setPositions(tilingSprite, geometry.positions);
  }
  destroy() {
    this._renderer = null;
  }
  _updateCanBatch(tilingSprite) {
    const renderableData = this._getTilingSpriteData(tilingSprite);
    const texture = tilingSprite.texture;
    let _nonPowOf2wrapping = true;
    if (this._renderer.type === types/* RendererType */.W.WEBGL) {
      _nonPowOf2wrapping = this._renderer.context.supports.nonPowOf2wrapping;
    }
    renderableData.canBatch = texture.textureMatrix.isSimple && (_nonPowOf2wrapping || texture.source.isPowerOfTwo);
    return renderableData.canBatch;
  }
}
/** @ignore */
TilingSpritePipe.extension = {
  type: [
    Extensions/* ExtensionType */.Ag.WebGLPipes,
    Extensions/* ExtensionType */.Ag.WebGPUPipes,
    Extensions/* ExtensionType */.Ag.CanvasPipes
  ],
  name: "tilingSprite"
};


//# sourceMappingURL=TilingSpritePipe.mjs.map

;// ./node_modules/pixi.js/lib/scene/sprite-tiling/init.mjs



"use strict";
Extensions/* extensions */.XO.add(TilingSpritePipe);
//# sourceMappingURL=init.mjs.map


/***/ },

/***/ 2290
(__unused_webpack___webpack_module__, __unused_webpack___webpack_exports__, __webpack_require__) {

"use strict";

// EXTERNAL MODULE: ./node_modules/pixi.js/lib/extensions/Extensions.mjs
var Extensions = __webpack_require__(8507);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/assets/cache/Cache.mjs
var Cache = __webpack_require__(1979);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/utils/logging/deprecation.mjs
var deprecation = __webpack_require__(4670);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/view/ViewContainer.mjs
var ViewContainer = __webpack_require__(4985);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/graphics/shared/GraphicsContext.mjs + 21 modules
var GraphicsContext = __webpack_require__(9516);
;// ./node_modules/pixi.js/lib/scene/graphics/shared/Graphics.mjs




"use strict";
class Graphics extends ViewContainer/* ViewContainer */.l {
  /**
   * Creates a new Graphics object.
   * @param options - Options for the Graphics.
   */
  constructor(options) {
    if (options instanceof GraphicsContext/* GraphicsContext */.T) {
      options = { context: options };
    }
    const { context, roundPixels, ...rest } = options || {};
    super({
      label: "Graphics",
      ...rest
    });
    /** @internal */
    this.renderPipeId = "graphics";
    if (!context) {
      this._context = this._ownedContext = new GraphicsContext/* GraphicsContext */.T();
    } else {
      this._context = context;
    }
    this._context.on("update", this.onViewUpdate, this);
    this.didViewUpdate = true;
    this.allowChildren = false;
    this.roundPixels = roundPixels ?? false;
  }
  set context(context) {
    if (context === this._context)
      return;
    this._context.off("update", this.onViewUpdate, this);
    this._context = context;
    this._context.on("update", this.onViewUpdate, this);
    this.onViewUpdate();
  }
  /**
   * The underlying graphics context used for drawing operations.
   * Controls how shapes and paths are rendered.
   * @example
   * ```ts
   * // Create a shared context
   * const sharedContext = new GraphicsContext();
   *
   * // Create graphics objects sharing the same context
   * const graphics1 = new Graphics();
   * const graphics2 = new Graphics();
   *
   * // Assign shared context
   * graphics1.context = sharedContext;
   * graphics2.context = sharedContext;
   *
   * // Both graphics will show the same shapes
   * sharedContext
   *     .rect(0, 0, 100, 100)
   *     .fill({ color: 0xff0000 });
   * ```
   * @see {@link GraphicsContext} For drawing operations
   * @see {@link GraphicsOptions} For context configuration
   */
  get context() {
    return this._context;
  }
  /**
   * The local bounds of the graphics object.
   * Returns the boundaries after all graphical operations but before any transforms.
   * @example
   * ```ts
   * const graphics = new Graphics();
   *
   * // Draw a shape
   * graphics
   *     .rect(0, 0, 100, 100)
   *     .fill({ color: 0xff0000 });
   *
   * // Get bounds information
   * const bounds = graphics.bounds;
   * console.log(bounds.width);  // 100
   * console.log(bounds.height); // 100
   * ```
   * @readonly
   * @see {@link Bounds} For bounds operations
   * @see {@link Container#getBounds} For transformed bounds
   */
  get bounds() {
    return this._context.bounds;
  }
  /**
   * Graphics objects do not need to update their bounds as the context handles this.
   * @private
   */
  updateBounds() {
  }
  /**
   * Checks if the object contains the given point.
   * Returns true if the point lies within the Graphics object's rendered area.
   * @example
   * ```ts
   * const graphics = new Graphics();
   *
   * // Draw a shape
   * graphics
   *     .rect(0, 0, 100, 100)
   *     .fill({ color: 0xff0000 });
   *
   * // Check point intersection
   * if (graphics.containsPoint({ x: 50, y: 50 })) {
   *     console.log('Point is inside rectangle!');
   * }
   * ```
   * @param point - The point to check in local coordinates
   * @returns True if the point is inside the Graphics object
   * @see {@link Graphics#bounds} For bounding box checks
   * @see {@link PointData} For point data structure
   */
  containsPoint(point) {
    return this._context.containsPoint(point);
  }
  /**
   * Destroys this graphics renderable and optionally its context.
   * @param options - Options parameter. A boolean will act as if all options
   *
   * If the context was created by this graphics and `destroy(false)` or `destroy()` is called
   * then the context will still be destroyed.
   *
   * If you want to explicitly not destroy this context that this graphics created,
   * then you should pass destroy({ context: false })
   *
   * If the context was passed in as an argument to the constructor then it will not be destroyed
   * @example
   * ```ts
   * // Destroy the graphics and its context
   * graphics.destroy();
   * graphics.destroy(true);
   * graphics.destroy({ context: true, texture: true, textureSource: true });
   * ```
   */
  destroy(options) {
    if (this._ownedContext && !options) {
      this._ownedContext.destroy(options);
    } else if (options === true || options?.context === true) {
      this._context.destroy(options);
    }
    this._ownedContext = null;
    this._context = null;
    super.destroy(options);
  }
  _callContextMethod(method, args) {
    this.context[method](...args);
    return this;
  }
  // --------------------------------------- GraphicsContext methods ---------------------------------------
  /**
   * Sets the current fill style of the graphics context.
   * The fill style can be a color, gradient, pattern, or a complex style object.
   * @example
   * ```ts
   * const graphics = new Graphics();
   *
   * // Basic color fill
   * graphics
   *     .setFillStyle({ color: 0xff0000 }) // Red fill
   *     .rect(0, 0, 100, 100)
   *     .fill();
   *
   * // Gradient fill
   * const gradient = new FillGradient({
   *    end: { x: 1, y: 0 },
   *    colorStops: [
   *         { offset: 0, color: 0xff0000 }, // Red at start
   *         { offset: 0.5, color: 0x00ff00 }, // Green at middle
   *         { offset: 1, color: 0x0000ff }, // Blue at end
   *    ],
   * });
   *
   * graphics
   *     .setFillStyle(gradient)
   *     .circle(100, 100, 50)
   *     .fill();
   *
   * // Pattern fill
   * const pattern = new FillPattern(texture);
   * graphics
   *     .setFillStyle({
   *         fill: pattern,
   *         alpha: 0.5
   *     })
   *     .rect(0, 0, 200, 200)
   *     .fill();
   * ```
   * @param {FillInput} args - The fill style to apply
   * @returns The Graphics instance for chaining
   * @see {@link FillStyle} For fill style options
   * @see {@link FillGradient} For gradient fills
   * @see {@link FillPattern} For pattern fills
   */
  setFillStyle(...args) {
    return this._callContextMethod("setFillStyle", args);
  }
  /**
   * Sets the current stroke style of the graphics context.
   * Similar to fill styles, stroke styles can encompass colors, gradients, patterns, or more detailed configurations.
   * @example
   * ```ts
   * const graphics = new Graphics();
   *
   * // Basic color stroke
   * graphics
   *     .setStrokeStyle({
   *         width: 2,
   *         color: 0x000000
   *     })
   *     .rect(0, 0, 100, 100)
   *     .stroke();
   *
   * // Complex stroke style
   * graphics
   *     .setStrokeStyle({
   *         width: 4,
   *         color: 0xff0000,
   *         alpha: 0.5,
   *         join: 'round',
   *         cap: 'round',
   *         alignment: 0.5
   *     })
   *     .circle(100, 100, 50)
   *     .stroke();
   *
   * // Gradient stroke
   * const gradient = new FillGradient({
   *    end: { x: 1, y: 0 },
   *    colorStops: [
   *         { offset: 0, color: 0xff0000 }, // Red at start
   *         { offset: 0.5, color: 0x00ff00 }, // Green at middle
   *         { offset: 1, color: 0x0000ff }, // Blue at end
   *    ],
   * });
   *
   * graphics
   *     .setStrokeStyle({
   *         width: 10,
   *         fill: gradient
   *     })
   *     .poly([0,0, 100,50, 0,100])
   *     .stroke();
   * ```
   * @param {StrokeInput} args - The stroke style to apply
   * @returns The Graphics instance for chaining
   * @see {@link StrokeStyle} For stroke style options
   * @see {@link FillGradient} For gradient strokes
   * @see {@link FillPattern} For pattern strokes
   */
  setStrokeStyle(...args) {
    return this._callContextMethod("setStrokeStyle", args);
  }
  fill(...args) {
    return this._callContextMethod("fill", args);
  }
  /**
   * Strokes the current path with the current stroke style or specified style.
   * Outlines the shape using the stroke settings.
   * @example
   * ```ts
   * const graphics = new Graphics();
   *
   * // Stroke with direct color
   * graphics
   *     .circle(50, 50, 25)
   *     .stroke({
   *         width: 2,
   *         color: 0xff0000
   *     }); // 2px red stroke
   *
   * // Fill with texture
   * graphics
   *    .rect(0, 0, 100, 100)
   *    .stroke(myTexture); // Fill with texture
   *
   * // Stroke with gradient
   * const gradient = new FillGradient({
   *     end: { x: 1, y: 0 },
   *     colorStops: [
   *         { offset: 0, color: 0xff0000 },
   *         { offset: 0.5, color: 0x00ff00 },
   *         { offset: 1, color: 0x0000ff },
   *     ],
   * });
   *
   * graphics
   *     .rect(0, 0, 100, 100)
   *     .stroke({
   *         width: 4,
   *         fill: gradient,
   *         alignment: 0.5,
   *         join: 'round'
   *     });
   * ```
   * @param {StrokeStyle} args - Optional stroke style to apply. Can be:
   * - A stroke style object with width, color, etc.
   * - A gradient
   * - A pattern
   * If omitted, uses current stroke style.
   * @returns The Graphics instance for chaining
   * @see {@link StrokeStyle} For stroke style options
   * @see {@link FillGradient} For gradient strokes
   * @see {@link setStrokeStyle} For setting default stroke style
   */
  stroke(...args) {
    return this._callContextMethod("stroke", args);
  }
  texture(...args) {
    return this._callContextMethod("texture", args);
  }
  /**
   * Resets the current path. Any previous path and its commands are discarded and a new path is
   * started. This is typically called before beginning a new shape or series of drawing commands.
   * @example
   * ```ts
   * const graphics = new Graphics();
   * graphics
   *     .circle(150, 150, 50)
   *     .fill({ color: 0x00ff00 })
   *     .beginPath() // Starts a new path
   *     .circle(250, 150, 50)
   *     .fill({ color: 0x0000ff });
   * ```
   * @returns The Graphics instance for chaining
   * @see {@link Graphics#moveTo} For starting a new subpath
   * @see {@link Graphics#closePath} For closing the current path
   */
  beginPath() {
    return this._callContextMethod("beginPath", []);
  }
  /**
   * Applies a cutout to the last drawn shape. This is used to create holes or complex shapes by
   * subtracting a path from the previously drawn path.
   *
   * If a hole is not completely in a shape, it will fail to cut correctly.
   * @example
   * ```ts
   * const graphics = new Graphics();
   *
   * // Draw outer circle
   * graphics
   *     .circle(100, 100, 50)
   *     .fill({ color: 0xff0000 });
   *     .circle(100, 100, 25) // Inner circle
   *     .cut() // Cuts out the inner circle from the outer circle
   * ```
   */
  cut() {
    return this._callContextMethod("cut", []);
  }
  arc(...args) {
    return this._callContextMethod("arc", args);
  }
  arcTo(...args) {
    return this._callContextMethod("arcTo", args);
  }
  arcToSvg(...args) {
    return this._callContextMethod("arcToSvg", args);
  }
  bezierCurveTo(...args) {
    return this._callContextMethod("bezierCurveTo", args);
  }
  /**
   * Closes the current path by drawing a straight line back to the start point.
   *
   * This is useful for completing shapes and ensuring they are properly closed for fills.
   * @example
   * ```ts
   * // Create a triangle with closed path
   * const graphics = new Graphics();
   * graphics
   *     .moveTo(50, 50)
   *     .lineTo(100, 100)
   *     .lineTo(0, 100)
   *     .closePath()
   * ```
   * @returns The Graphics instance for method chaining
   * @see {@link Graphics#beginPath} For starting a new path
   * @see {@link Graphics#fill} For filling closed paths
   * @see {@link Graphics#stroke} For stroking paths
   */
  closePath() {
    return this._callContextMethod("closePath", []);
  }
  ellipse(...args) {
    return this._callContextMethod("ellipse", args);
  }
  circle(...args) {
    return this._callContextMethod("circle", args);
  }
  path(...args) {
    return this._callContextMethod("path", args);
  }
  lineTo(...args) {
    return this._callContextMethod("lineTo", args);
  }
  moveTo(...args) {
    return this._callContextMethod("moveTo", args);
  }
  quadraticCurveTo(...args) {
    return this._callContextMethod("quadraticCurveTo", args);
  }
  rect(...args) {
    return this._callContextMethod("rect", args);
  }
  roundRect(...args) {
    return this._callContextMethod("roundRect", args);
  }
  poly(...args) {
    return this._callContextMethod("poly", args);
  }
  regularPoly(...args) {
    return this._callContextMethod("regularPoly", args);
  }
  roundPoly(...args) {
    return this._callContextMethod("roundPoly", args);
  }
  roundShape(...args) {
    return this._callContextMethod("roundShape", args);
  }
  filletRect(...args) {
    return this._callContextMethod("filletRect", args);
  }
  chamferRect(...args) {
    return this._callContextMethod("chamferRect", args);
  }
  star(...args) {
    return this._callContextMethod("star", args);
  }
  svg(...args) {
    return this._callContextMethod("svg", args);
  }
  restore(...args) {
    return this._callContextMethod("restore", args);
  }
  /**
   * Saves the current graphics state onto a stack. The state includes:
   * - Current transformation matrix
   * - Current fill style
   * - Current stroke style
   * @example
   * ```ts
   * const graphics = new Graphics();
   *
   * // Save state before complex operations
   * graphics.save();
   *
   * // Create transformed and styled shape
   * graphics
   *     .translateTransform(100, 100)
   *     .rotateTransform(Math.PI / 4)
   *     .setFillStyle({
   *         color: 0xff0000,
   *         alpha: 0.5
   *     })
   *     .rect(-25, -25, 50, 50)
   *     .fill();
   *
   * // Restore to original state
   * graphics.restore();
   *
   * // Continue drawing with previous state
   * graphics
   *     .circle(50, 50, 25)
   *     .fill();
   * ```
   * @returns The Graphics instance for method chaining
   * @see {@link Graphics#restore} For restoring the saved state
   * @see {@link Graphics#setTransform} For setting transformations
   */
  save() {
    return this._callContextMethod("save", []);
  }
  /**
   * Returns the current transformation matrix of the graphics context.
   * This matrix represents all accumulated transformations including translate, scale, and rotate.
   * @example
   * ```ts
   * const graphics = new Graphics();
   *
   * // Apply some transformations
   * graphics
   *     .translateTransform(100, 100)
   *     .rotateTransform(Math.PI / 4);
   *
   * // Get the current transform matrix
   * const matrix = graphics.getTransform();
   * console.log(matrix.tx, matrix.ty); // 100, 100
   *
   * // Use the matrix for other operations
   * graphics
   *     .setTransform(matrix)
   *     .circle(0, 0, 50)
   *     .fill({ color: 0xff0000 });
   * ```
   * @returns The current transformation matrix.
   * @see {@link Graphics#setTransform} For setting the transform matrix
   * @see {@link Matrix} For matrix operations
   */
  getTransform() {
    return this.context.getTransform();
  }
  /**
   * Resets the current transformation matrix to the identity matrix, effectively removing
   * any transformations (rotation, scaling, translation) previously applied.
   * @example
   * ```ts
   * const graphics = new Graphics();
   *
   * // Apply transformations
   * graphics
   *     .translateTransform(100, 100)
   *     .scaleTransform(2, 2)
   *     .circle(0, 0, 25)
   *     .fill({ color: 0xff0000 });
   * // Reset transform to default state
   * graphics
   *     .resetTransform()
   *     .circle(50, 50, 25) // Will draw at actual coordinates
   *     .fill({ color: 0x00ff00 });
   * ```
   * @returns The Graphics instance for method chaining
   * @see {@link Graphics#getTransform} For getting the current transform
   * @see {@link Graphics#setTransform} For setting a specific transform
   * @see {@link Graphics#save} For saving the current transform state
   * @see {@link Graphics#restore} For restoring a previous transform state
   */
  resetTransform() {
    return this._callContextMethod("resetTransform", []);
  }
  rotateTransform(...args) {
    return this._callContextMethod("rotate", args);
  }
  scaleTransform(...args) {
    return this._callContextMethod("scale", args);
  }
  setTransform(...args) {
    return this._callContextMethod("setTransform", args);
  }
  transform(...args) {
    return this._callContextMethod("transform", args);
  }
  translateTransform(...args) {
    return this._callContextMethod("translate", args);
  }
  /**
   * Clears all drawing commands from the graphics context, effectively resetting it.
   * This includes clearing the current path, fill style, stroke style, and transformations.
   *
   * > [!NOTE] Graphics objects are not designed to be continuously cleared and redrawn.
   * > Instead, they are intended to be used for static or semi-static graphics that
   * > can be redrawn as needed. Frequent clearing and redrawing may lead to performance issues.
   * @example
   * ```ts
   * const graphics = new Graphics();
   *
   * // Draw some shapes
   * graphics
   *     .circle(100, 100, 50)
   *     .fill({ color: 0xff0000 })
   *     .rect(200, 100, 100, 50)
   *     .fill({ color: 0x00ff00 });
   *
   * // Clear all graphics
   * graphics.clear();
   *
   * // Start fresh with new shapes
   * graphics
   *     .circle(150, 150, 30)
   *     .fill({ color: 0x0000ff });
   * ```
   * @returns The Graphics instance for method chaining
   * @see {@link Graphics#beginPath} For starting a new path without clearing styles
   * @see {@link Graphics#save} For saving the current state
   * @see {@link Graphics#restore} For restoring a previous state
   */
  clear() {
    return this._callContextMethod("clear", []);
  }
  /**
   * Gets or sets the current fill style for the graphics context. The fill style determines
   * how shapes are filled when using the fill() method.
   * @example
   * ```ts
   * const graphics = new Graphics();
   *
   * // Basic color fill
   * graphics.fillStyle = {
   *     color: 0xff0000,  // Red
   *     alpha: 1
   * };
   *
   * // Using gradients
   * const gradient = new FillGradient({
   *     end: { x: 0, y: 1 }, // Vertical gradient
   *     stops: [
   *         { offset: 0, color: 0xff0000, alpha: 1 }, // Start color
   *         { offset: 1, color: 0x0000ff, alpha: 1 }  // End color
   *     ]
   * });
   *
   * graphics.fillStyle = {
   *     fill: gradient,
   *     alpha: 0.8
   * };
   *
   * // Using patterns
   * graphics.fillStyle = {
   *     texture: myTexture,
   *     alpha: 1,
   *     matrix: new Matrix()
   *         .scale(0.5, 0.5)
   *         .rotate(Math.PI / 4)
   * };
   * ```
   * @type {ConvertedFillStyle}
   * @see {@link FillStyle} For all available fill style options
   * @see {@link FillGradient} For creating gradient fills
   * @see {@link Graphics#fill} For applying the fill to paths
   */
  get fillStyle() {
    return this._context.fillStyle;
  }
  set fillStyle(value) {
    this._context.fillStyle = value;
  }
  /**
   * Gets or sets the current stroke style for the graphics context. The stroke style determines
   * how paths are outlined when using the stroke() method.
   * @example
   * ```ts
   * const graphics = new Graphics();
   *
   * // Basic stroke style
   * graphics.strokeStyle = {
   *     width: 2,
   *     color: 0xff0000,
   *     alpha: 1
   * };
   *
   * // Using with gradients
   * const gradient = new FillGradient({
   *   end: { x: 0, y: 1 },
   *   stops: [
   *       { offset: 0, color: 0xff0000, alpha: 1 },
   *       { offset: 1, color: 0x0000ff, alpha: 1 }
   *   ]
   * });
   *
   * graphics.strokeStyle = {
   *     width: 4,
   *     fill: gradient,
   *     alignment: 0.5,
   *     join: 'round',
   *     cap: 'round'
   * };
   *
   * // Complex stroke settings
   * graphics.strokeStyle = {
   *     width: 6,
   *     color: 0x00ff00,
   *     alpha: 0.5,
   *     join: 'miter',
   *     miterLimit: 10,
   * };
   * ```
   * @see {@link StrokeStyle} For all available stroke style options
   * @see {@link Graphics#stroke} For applying the stroke to paths
   */
  get strokeStyle() {
    return this._context.strokeStyle;
  }
  set strokeStyle(value) {
    this._context.strokeStyle = value;
  }
  /**
   * Creates a new Graphics object that copies the current graphics content.
   * The clone can either share the same context (shallow clone) or have its own independent
   * context (deep clone).
   * @example
   * ```ts
   * const graphics = new Graphics();
   *
   * // Create original graphics content
   * graphics
   *     .circle(100, 100, 50)
   *     .fill({ color: 0xff0000 });
   *
   * // Create a shallow clone (shared context)
   * const shallowClone = graphics.clone();
   *
   * // Changes to original affect the clone
   * graphics
   *     .circle(200, 100, 30)
   *     .fill({ color: 0x00ff00 });
   *
   * // Create a deep clone (independent context)
   * const deepClone = graphics.clone(true);
   *
   * // Modify deep clone independently
   * deepClone
   *     .translateTransform(100, 100)
   *     .circle(0, 0, 40)
   *     .fill({ color: 0x0000ff });
   * ```
   * @param deep - Whether to create a deep clone of the graphics object.
   *              If false (default), the context will be shared between objects.
   *              If true, creates an independent copy of the context.
   * @returns A new Graphics instance with either shared or copied context
   * @see {@link Graphics#context} For accessing the underlying graphics context
   * @see {@link GraphicsContext} For understanding the shared context behavior
   */
  clone(deep = false) {
    if (deep) {
      return new Graphics(this._context.clone());
    }
    this._ownedContext = null;
    const clone = new Graphics(this._context);
    return clone;
  }
  // -------- v7 deprecations ---------
  /**
   * @param width
   * @param color
   * @param alpha
   * @deprecated since 8.0.0 Use {@link Graphics#setStrokeStyle} instead
   */
  lineStyle(width, color, alpha) {
    (0,deprecation/* deprecation */.t6)(deprecation/* v8_0_0 */.lj, "Graphics#lineStyle is no longer needed. Use Graphics#setStrokeStyle to set the stroke style.");
    const strokeStyle = {};
    width && (strokeStyle.width = width);
    color && (strokeStyle.color = color);
    alpha && (strokeStyle.alpha = alpha);
    this.context.strokeStyle = strokeStyle;
    return this;
  }
  /**
   * @param color
   * @param alpha
   * @deprecated since 8.0.0 Use {@link Graphics#fill} instead
   */
  beginFill(color, alpha) {
    (0,deprecation/* deprecation */.t6)(deprecation/* v8_0_0 */.lj, "Graphics#beginFill is no longer needed. Use Graphics#fill to fill the shape with the desired style.");
    const fillStyle = {};
    if (color !== void 0)
      fillStyle.color = color;
    if (alpha !== void 0)
      fillStyle.alpha = alpha;
    this.context.fillStyle = fillStyle;
    return this;
  }
  /**
   * @deprecated since 8.0.0 Use {@link Graphics#fill} instead
   */
  endFill() {
    (0,deprecation/* deprecation */.t6)(deprecation/* v8_0_0 */.lj, "Graphics#endFill is no longer needed. Use Graphics#fill to fill the shape with the desired style.");
    this.context.fill();
    const strokeStyle = this.context.strokeStyle;
    if (strokeStyle.width !== GraphicsContext/* GraphicsContext */.T.defaultStrokeStyle.width || strokeStyle.color !== GraphicsContext/* GraphicsContext */.T.defaultStrokeStyle.color || strokeStyle.alpha !== GraphicsContext/* GraphicsContext */.T.defaultStrokeStyle.alpha) {
      this.context.stroke();
    }
    return this;
  }
  /**
   * @param {...any} args
   * @deprecated since 8.0.0 Use {@link Graphics#circle} instead
   */
  drawCircle(...args) {
    (0,deprecation/* deprecation */.t6)(deprecation/* v8_0_0 */.lj, "Graphics#drawCircle has been renamed to Graphics#circle");
    return this._callContextMethod("circle", args);
  }
  /**
   * @param {...any} args
   * @deprecated since 8.0.0 Use {@link Graphics#ellipse} instead
   */
  drawEllipse(...args) {
    (0,deprecation/* deprecation */.t6)(deprecation/* v8_0_0 */.lj, "Graphics#drawEllipse has been renamed to Graphics#ellipse");
    return this._callContextMethod("ellipse", args);
  }
  /**
   * @param {...any} args
   * @deprecated since 8.0.0 Use {@link Graphics#poly} instead
   */
  drawPolygon(...args) {
    (0,deprecation/* deprecation */.t6)(deprecation/* v8_0_0 */.lj, "Graphics#drawPolygon has been renamed to Graphics#poly");
    return this._callContextMethod("poly", args);
  }
  /**
   * @param {...any} args
   * @deprecated since 8.0.0 Use {@link Graphics#rect} instead
   */
  drawRect(...args) {
    (0,deprecation/* deprecation */.t6)(deprecation/* v8_0_0 */.lj, "Graphics#drawRect has been renamed to Graphics#rect");
    return this._callContextMethod("rect", args);
  }
  /**
   * @param {...any} args
   * @deprecated since 8.0.0 Use {@link Graphics#roundRect} instead
   */
  drawRoundedRect(...args) {
    (0,deprecation/* deprecation */.t6)(deprecation/* v8_0_0 */.lj, "Graphics#drawRoundedRect has been renamed to Graphics#roundRect");
    return this._callContextMethod("roundRect", args);
  }
  /**
   * @param {...any} args
   * @deprecated since 8.0.0 Use {@link Graphics#star} instead
   */
  drawStar(...args) {
    (0,deprecation/* deprecation */.t6)(deprecation/* v8_0_0 */.lj, "Graphics#drawStar has been renamed to Graphics#star");
    return this._callContextMethod("star", args);
  }
}


//# sourceMappingURL=Graphics.mjs.map

// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/text/canvas/CanvasTextMetrics.mjs
var CanvasTextMetrics = __webpack_require__(4016);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/maths/matrix/Matrix.mjs
var Matrix = __webpack_require__(9313);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/high-shader/compileHighShaderToProgram.mjs + 8 modules
var compileHighShaderToProgram = __webpack_require__(7714);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/high-shader/shader-bits/colorBit.mjs
var colorBit = __webpack_require__(4459);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/high-shader/shader-bits/generateTextureBatchBit.mjs
var generateTextureBatchBit = __webpack_require__(4000);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/high-shader/shader-bits/roundPixelsBit.mjs
var roundPixelsBit = __webpack_require__(6665);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/gl/shader/getBatchSamplersUniformGroup.mjs
var getBatchSamplersUniformGroup = __webpack_require__(6040);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/shader/Shader.mjs
var Shader = __webpack_require__(8475);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/shader/UniformGroup.mjs + 2 modules
var UniformGroup = __webpack_require__(1911);
;// ./node_modules/pixi.js/lib/scene/text/sdfShader/shader-bits/localUniformMSDFBit.mjs

const localUniformMSDFBit = {
  name: "local-uniform-msdf-bit",
  vertex: {
    header: (
      /* wgsl */
      `
            struct LocalUniforms {
                uColor:vec4<f32>,
                uTransformMatrix:mat3x3<f32>,
                uDistance: f32,
                uRound:f32,
            }

            @group(2) @binding(0) var<uniform> localUniforms : LocalUniforms;
        `
    ),
    main: (
      /* wgsl */
      `
            vColor *= localUniforms.uColor;
            modelMatrix *= localUniforms.uTransformMatrix;
        `
    ),
    end: (
      /* wgsl */
      `
            if(localUniforms.uRound == 1)
            {
                vPosition = vec4(roundPixels(vPosition.xy, globalUniforms.uResolution), vPosition.zw);
            }
        `
    )
  },
  fragment: {
    header: (
      /* wgsl */
      `
            struct LocalUniforms {
                uColor:vec4<f32>,
                uTransformMatrix:mat3x3<f32>,
                uDistance: f32
            }

            @group(2) @binding(0) var<uniform> localUniforms : LocalUniforms;
         `
    ),
    main: (
      /* wgsl */
      `
            outColor = vec4<f32>(calculateMSDFAlpha(outColor, localUniforms.uColor, localUniforms.uDistance));
        `
    )
  }
};
const localUniformMSDFBitGl = {
  name: "local-uniform-msdf-bit",
  vertex: {
    header: (
      /* glsl */
      `
            uniform mat3 uTransformMatrix;
            uniform vec4 uColor;
            uniform float uRound;
        `
    ),
    main: (
      /* glsl */
      `
            vColor *= uColor;
            modelMatrix *= uTransformMatrix;
        `
    ),
    end: (
      /* glsl */
      `
            if(uRound == 1.)
            {
                gl_Position.xy = roundPixels(gl_Position.xy, uResolution);
            }
        `
    )
  },
  fragment: {
    header: (
      /* glsl */
      `
            uniform float uDistance;
         `
    ),
    main: (
      /* glsl */
      `
            outColor = vec4(calculateMSDFAlpha(outColor, vColor, uDistance));
        `
    )
  }
};


//# sourceMappingURL=localUniformMSDFBit.mjs.map

;// ./node_modules/pixi.js/lib/scene/text/sdfShader/shader-bits/mSDFBit.mjs

const mSDFBit = {
  name: "msdf-bit",
  fragment: {
    header: (
      /* wgsl */
      `
            fn calculateMSDFAlpha(msdfColor:vec4<f32>, shapeColor:vec4<f32>, distance:f32) -> f32 {

                // MSDF
                var median = msdfColor.r + msdfColor.g + msdfColor.b -
                    min(msdfColor.r, min(msdfColor.g, msdfColor.b)) -
                    max(msdfColor.r, max(msdfColor.g, msdfColor.b));

                // SDF
                median = min(median, msdfColor.a);

                var screenPxDistance = distance * (median - 0.5);
                var alpha = clamp(screenPxDistance + 0.5, 0.0, 1.0);
                if (median < 0.01) {
                    alpha = 0.0;
                } else if (median > 0.99) {
                    alpha = 1.0;
                }

                // Gamma correction for coverage-like alpha
                var luma: f32 = dot(shapeColor.rgb, vec3<f32>(0.299, 0.587, 0.114));
                var gamma: f32 = mix(1.0, 1.0 / 2.2, luma);
                var coverage: f32 = pow(shapeColor.a * alpha, gamma);

                return coverage;

            }
        `
    )
  }
};
const mSDFBitGl = {
  name: "msdf-bit",
  fragment: {
    header: (
      /* glsl */
      `
            float calculateMSDFAlpha(vec4 msdfColor, vec4 shapeColor, float distance) {

                // MSDF
                float median = msdfColor.r + msdfColor.g + msdfColor.b -
                                min(msdfColor.r, min(msdfColor.g, msdfColor.b)) -
                                max(msdfColor.r, max(msdfColor.g, msdfColor.b));

                // SDF
                median = min(median, msdfColor.a);

                float screenPxDistance = distance * (median - 0.5);
                float alpha = clamp(screenPxDistance + 0.5, 0.0, 1.0);

                if (median < 0.01) {
                    alpha = 0.0;
                } else if (median > 0.99) {
                    alpha = 1.0;
                }

                // Gamma correction for coverage-like alpha
                float luma = dot(shapeColor.rgb, vec3(0.299, 0.587, 0.114));
                float gamma = mix(1.0, 1.0 / 2.2, luma);
                float coverage = pow(shapeColor.a * alpha, gamma);

                return coverage;
            }
        `
    )
  }
};


//# sourceMappingURL=mSDFBit.mjs.map

;// ./node_modules/pixi.js/lib/scene/text/sdfShader/SdfShader.mjs











"use strict";
let gpuProgram;
let glProgram;
class SdfShader extends Shader/* Shader */.M {
  constructor(maxTextures) {
    const uniforms = new UniformGroup/* UniformGroup */.k({
      uColor: { value: new Float32Array([1, 1, 1, 1]), type: "vec4<f32>" },
      uTransformMatrix: { value: new Matrix/* Matrix */.u(), type: "mat3x3<f32>" },
      uDistance: { value: 4, type: "f32" },
      uRound: { value: 0, type: "f32" }
    });
    gpuProgram ?? (gpuProgram = (0,compileHighShaderToProgram/* compileHighShaderGpuProgram */.v)({
      name: "sdf-shader",
      bits: [
        colorBit/* colorBit */.F,
        (0,generateTextureBatchBit/* generateTextureBatchBit */._)(maxTextures),
        localUniformMSDFBit,
        mSDFBit,
        roundPixelsBit/* roundPixelsBit */.b
      ]
    }));
    glProgram ?? (glProgram = (0,compileHighShaderToProgram/* compileHighShaderGlProgram */.I)({
      name: "sdf-shader",
      bits: [
        colorBit/* colorBitGl */.a,
        (0,generateTextureBatchBit/* generateTextureBatchBitGl */.P)(maxTextures),
        localUniformMSDFBitGl,
        mSDFBitGl,
        roundPixelsBit/* roundPixelsBitGl */.m
      ]
    }));
    super({
      glProgram,
      gpuProgram,
      resources: {
        localUniforms: uniforms,
        batchSamplers: (0,getBatchSamplersUniformGroup/* getBatchSamplersUniformGroup */.n)(maxTextures)
      }
    });
  }
}


//# sourceMappingURL=SdfShader.mjs.map

// EXTERNAL MODULE: ./node_modules/tiny-lru/dist/tiny-lru.js
var tiny_lru = __webpack_require__(5957);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/utils/logging/warn.mjs
var warn = __webpack_require__(268);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/text/TextStyle.mjs
var TextStyle = __webpack_require__(8291);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/color/Color.mjs + 2 modules
var Color = __webpack_require__(3556);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/maths/shapes/Rectangle.mjs
var Rectangle = __webpack_require__(9252);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/texture/CanvasPool.mjs
var CanvasPool = __webpack_require__(7608);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/texture/sources/ImageSource.mjs
var ImageSource = __webpack_require__(8293);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/texture/Texture.mjs + 2 modules
var Texture = __webpack_require__(226);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/texture/TextureStyle.mjs
var TextureStyle = __webpack_require__(218);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/text/canvas/utils/fontStringFromTextStyle.mjs
var fontStringFromTextStyle = __webpack_require__(1242);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/text/canvas/utils/getCanvasFillStyle.mjs
var getCanvasFillStyle = __webpack_require__(3548);
// EXTERNAL MODULE: ./node_modules/eventemitter3/index.mjs
var eventemitter3 = __webpack_require__(4486);
;// ./node_modules/pixi.js/lib/scene/text-bitmap/AbstractBitmapFont.mjs



"use strict";
class AbstractBitmapFont extends eventemitter3/* default */.A {
  constructor() {
    super(...arguments);
    /** The map of characters by character code. */
    this.chars = /* @__PURE__ */ Object.create(null);
    /**
     * The line-height of the font face in pixels.
     * @type {number}
     */
    this.lineHeight = 0;
    /**
     * The name of the font face
     * @type {string}
     */
    this.fontFamily = "";
    /** The metrics of the font face. */
    this.fontMetrics = { fontSize: 0, ascent: 0, descent: 0 };
    /**
     * The offset of the font face from the baseline.
     * @type {number}
     */
    this.baseLineOffset = 0;
    /** The range and type of the distance field for this font. */
    this.distanceField = { type: "none", range: 0 };
    /** The map of base page textures (i.e., sheets of glyphs). */
    this.pages = [];
    /** should the fill for this font be applied as a tint to the text. */
    this.applyFillAsTint = true;
    /** The size of the font face in pixels. */
    this.baseMeasurementFontSize = 100;
    this.baseRenderedFontSize = 100;
  }
  /**
   * The name of the font face.
   * @deprecated since 8.0.0 Use `fontFamily` instead.
   */
  get font() {
    (0,deprecation/* deprecation */.t6)(deprecation/* v8_0_0 */.lj, "BitmapFont.font is deprecated, please use BitmapFont.fontFamily instead.");
    return this.fontFamily;
  }
  /**
   * The map of base page textures (i.e., sheets of glyphs).
   * @deprecated since 8.0.0 Use `pages` instead.
   */
  get pageTextures() {
    (0,deprecation/* deprecation */.t6)(deprecation/* v8_0_0 */.lj, "BitmapFont.pageTextures is deprecated, please use BitmapFont.pages instead.");
    return this.pages;
  }
  /**
   * The size of the font face in pixels.
   * @deprecated since 8.0.0 Use `fontMetrics.fontSize` instead.
   */
  get size() {
    (0,deprecation/* deprecation */.t6)(deprecation/* v8_0_0 */.lj, "BitmapFont.size is deprecated, please use BitmapFont.fontMetrics.fontSize instead.");
    return this.fontMetrics.fontSize;
  }
  /**
   * The kind of distance field for this font or "none".
   * @deprecated since 8.0.0 Use `distanceField.type` instead.
   */
  get distanceFieldRange() {
    (0,deprecation/* deprecation */.t6)(deprecation/* v8_0_0 */.lj, "BitmapFont.distanceFieldRange is deprecated, please use BitmapFont.distanceField.range instead.");
    return this.distanceField.range;
  }
  /**
   * The range of the distance field in pixels.
   * @deprecated since 8.0.0 Use `distanceField.range` instead.
   */
  get distanceFieldType() {
    (0,deprecation/* deprecation */.t6)(deprecation/* v8_0_0 */.lj, "BitmapFont.distanceFieldType is deprecated, please use BitmapFont.distanceField.type instead.");
    return this.distanceField.type;
  }
  destroy(destroyTextures = false) {
    this.emit("destroy", this);
    this.removeAllListeners();
    for (const i in this.chars) {
      this.chars[i].texture?.destroy();
    }
    this.chars = null;
    if (destroyTextures) {
      this.pages.forEach((page) => page.texture.destroy(true));
      this.pages = null;
    }
  }
}


//# sourceMappingURL=AbstractBitmapFont.mjs.map

;// ./node_modules/pixi.js/lib/scene/text-bitmap/DynamicBitmapFont.mjs













"use strict";
const _DynamicBitmapFont = class _DynamicBitmapFont extends AbstractBitmapFont {
  /**
   * @param options - The options for the dynamic bitmap font.
   */
  constructor(options) {
    super();
    /**
     * this is a resolution modifier for the font size..
     * texture resolution will also be used to scale texture according to its font size also
     */
    this.resolution = 1;
    /** The pages of the font. */
    this.pages = [];
    this._padding = 0;
    this._measureCache = /* @__PURE__ */ Object.create(null);
    this._currentChars = [];
    this._currentX = 0;
    this._currentY = 0;
    this._currentMaxCharHeight = 0;
    this._currentPageIndex = -1;
    this._skipKerning = false;
    const dynamicOptions = { ..._DynamicBitmapFont.defaultOptions, ...options };
    this._textureSize = dynamicOptions.textureSize;
    this._mipmap = dynamicOptions.mipmap;
    const style = dynamicOptions.style.clone();
    if (dynamicOptions.overrideFill) {
      style._fill.color = 16777215;
      style._fill.alpha = 1;
      style._fill.texture = Texture/* Texture */.g.WHITE;
      style._fill.fill = null;
    }
    this.applyFillAsTint = dynamicOptions.overrideFill;
    const requestedFontSize = style.fontSize;
    style.fontSize = this.baseMeasurementFontSize;
    const font = (0,fontStringFromTextStyle/* fontStringFromTextStyle */.Z)(style);
    if (dynamicOptions.overrideSize) {
      if (style._stroke) {
        style._stroke.width *= this.baseRenderedFontSize / requestedFontSize;
      }
    } else {
      style.fontSize = this.baseRenderedFontSize = requestedFontSize;
    }
    this._style = style;
    this._skipKerning = dynamicOptions.skipKerning ?? false;
    this.resolution = dynamicOptions.resolution ?? 1;
    this._padding = dynamicOptions.padding ?? 4;
    if (dynamicOptions.textureStyle) {
      this._textureStyle = dynamicOptions.textureStyle instanceof TextureStyle/* TextureStyle */.n ? dynamicOptions.textureStyle : new TextureStyle/* TextureStyle */.n(dynamicOptions.textureStyle);
    }
    this.fontMetrics = CanvasTextMetrics/* CanvasTextMetrics */.P.measureFont(font);
    this.lineHeight = style.lineHeight || this.fontMetrics.fontSize || style.fontSize;
  }
  ensureCharacters(chars) {
    const charList = CanvasTextMetrics/* CanvasTextMetrics */.P.graphemeSegmenter(chars).filter((char) => !this._currentChars.includes(char)).filter((char, index, self) => self.indexOf(char) === index);
    if (!charList.length)
      return;
    this._currentChars = [...this._currentChars, ...charList];
    let pageData;
    if (this._currentPageIndex === -1) {
      pageData = this._nextPage();
    } else {
      pageData = this.pages[this._currentPageIndex];
    }
    let { canvas, context } = pageData.canvasAndContext;
    let textureSource = pageData.texture.source;
    const style = this._style;
    let currentX = this._currentX;
    let currentY = this._currentY;
    let currentMaxCharHeight = this._currentMaxCharHeight;
    const fontScale = this.baseRenderedFontSize / this.baseMeasurementFontSize;
    const padding = this._padding * fontScale;
    let skipTexture = false;
    const maxTextureWidth = canvas.width / this.resolution;
    const maxTextureHeight = canvas.height / this.resolution;
    for (let i = 0; i < charList.length; i++) {
      const char = charList[i];
      const metrics = CanvasTextMetrics/* CanvasTextMetrics */.P.measureText(char, style, canvas, false);
      metrics.lineHeight = metrics.height;
      const width = metrics.width * fontScale;
      const textureGlyphWidth = Math.ceil((style.fontStyle === "italic" ? 2 : 1) * width);
      const height = metrics.height * fontScale;
      const paddedWidth = textureGlyphWidth + padding * 2;
      const paddedHeight = height + padding * 2;
      skipTexture = false;
      if (char !== "\n" && char !== "\r" && char !== "	" && char !== " ") {
        skipTexture = true;
        currentMaxCharHeight = Math.ceil(Math.max(paddedHeight, currentMaxCharHeight));
      }
      if (currentX + paddedWidth > maxTextureWidth) {
        currentY += currentMaxCharHeight;
        currentMaxCharHeight = paddedHeight;
        currentX = 0;
        if (currentY + currentMaxCharHeight > maxTextureHeight) {
          textureSource.update();
          const pageData2 = this._nextPage();
          canvas = pageData2.canvasAndContext.canvas;
          context = pageData2.canvasAndContext.context;
          textureSource = pageData2.texture.source;
          currentX = 0;
          currentY = 0;
          currentMaxCharHeight = 0;
        }
      }
      const xAdvance = width / fontScale - (style.dropShadow?.distance ?? 0) - (style._stroke?.width ?? 0);
      this.chars[char] = {
        id: char.codePointAt(0),
        xOffset: -this._padding,
        yOffset: -this._padding,
        xAdvance,
        kerning: {}
      };
      if (skipTexture) {
        this._drawGlyph(
          context,
          metrics,
          currentX + padding,
          currentY + padding,
          fontScale,
          style
        );
        const px = textureSource.width * fontScale;
        const py = textureSource.height * fontScale;
        const frame = new Rectangle/* Rectangle */.M(
          currentX / px * textureSource.width,
          currentY / py * textureSource.height,
          paddedWidth / px * textureSource.width,
          paddedHeight / py * textureSource.height
        );
        this.chars[char].texture = new Texture/* Texture */.g({
          source: textureSource,
          frame
        });
        currentX += Math.ceil(paddedWidth);
      }
    }
    textureSource.update();
    this._currentX = currentX;
    this._currentY = currentY;
    this._currentMaxCharHeight = currentMaxCharHeight;
    this._skipKerning && this._applyKerning(charList, context);
  }
  /**
   * @deprecated since 8.0.0
   * The map of base page textures (i.e., sheets of glyphs).
   */
  get pageTextures() {
    (0,deprecation/* deprecation */.t6)(deprecation/* v8_0_0 */.lj, "BitmapFont.pageTextures is deprecated, please use BitmapFont.pages instead.");
    return this.pages;
  }
  _applyKerning(newChars, context) {
    const measureCache = this._measureCache;
    for (let i = 0; i < newChars.length; i++) {
      const first = newChars[i];
      for (let j = 0; j < this._currentChars.length; j++) {
        const second = this._currentChars[j];
        let c1 = measureCache[first];
        if (!c1)
          c1 = measureCache[first] = context.measureText(first).width;
        let c2 = measureCache[second];
        if (!c2)
          c2 = measureCache[second] = context.measureText(second).width;
        let total = context.measureText(first + second).width;
        let amount = total - (c1 + c2);
        if (amount) {
          this.chars[first].kerning[second] = amount;
        }
        total = context.measureText(first + second).width;
        amount = total - (c1 + c2);
        if (amount) {
          this.chars[second].kerning[first] = amount;
        }
      }
    }
  }
  _nextPage() {
    this._currentPageIndex++;
    const textureResolution = this.resolution;
    const canvasAndContext = CanvasPool/* CanvasPool */.N.getOptimalCanvasAndContext(
      this._textureSize,
      this._textureSize,
      textureResolution
    );
    this._setupContext(canvasAndContext.context, this._style, textureResolution);
    const resolution = textureResolution * (this.baseRenderedFontSize / this.baseMeasurementFontSize);
    const texture = new Texture/* Texture */.g({
      source: new ImageSource/* ImageSource */.b({
        resource: canvasAndContext.canvas,
        resolution,
        alphaMode: "premultiply-alpha-on-upload",
        autoGenerateMipmaps: this._mipmap
      })
    });
    if (this._textureStyle) {
      texture.source.style = this._textureStyle;
    }
    const pageData = {
      canvasAndContext,
      texture
    };
    this.pages[this._currentPageIndex] = pageData;
    return pageData;
  }
  // canvas style!
  _setupContext(context, style, resolution) {
    style.fontSize = this.baseRenderedFontSize;
    context.scale(resolution, resolution);
    context.font = (0,fontStringFromTextStyle/* fontStringFromTextStyle */.Z)(style);
    style.fontSize = this.baseMeasurementFontSize;
    context.textBaseline = style.textBaseline;
    const stroke = style._stroke;
    const strokeThickness = stroke?.width ?? 0;
    if (stroke) {
      context.lineWidth = strokeThickness;
      context.lineJoin = stroke.join;
      context.miterLimit = stroke.miterLimit;
      context.strokeStyle = (0,getCanvasFillStyle/* getCanvasFillStyle */.r)(stroke, context);
    }
    if (style._fill) {
      context.fillStyle = (0,getCanvasFillStyle/* getCanvasFillStyle */.r)(style._fill, context);
    }
    if (style.dropShadow) {
      const shadowOptions = style.dropShadow;
      const rgb = Color/* Color */.Q.shared.setValue(shadowOptions.color).toArray();
      const dropShadowBlur = shadowOptions.blur * resolution;
      const dropShadowDistance = shadowOptions.distance * resolution;
      context.shadowColor = `rgba(${rgb[0] * 255},${rgb[1] * 255},${rgb[2] * 255},${shadowOptions.alpha})`;
      context.shadowBlur = dropShadowBlur;
      context.shadowOffsetX = Math.cos(shadowOptions.angle) * dropShadowDistance;
      context.shadowOffsetY = Math.sin(shadowOptions.angle) * dropShadowDistance;
    } else {
      context.shadowColor = "black";
      context.shadowBlur = 0;
      context.shadowOffsetX = 0;
      context.shadowOffsetY = 0;
    }
  }
  _drawGlyph(context, metrics, x, y, fontScale, style) {
    const char = metrics.text;
    const fontProperties = metrics.fontProperties;
    const stroke = style._stroke;
    const strokeThickness = (stroke?.width ?? 0) * fontScale;
    const tx = x + strokeThickness / 2;
    const ty = y - strokeThickness / 2;
    const descent = fontProperties.descent * fontScale;
    const lineHeight = metrics.lineHeight * fontScale;
    let removeShadow = false;
    if (style.stroke && strokeThickness) {
      removeShadow = true;
      context.strokeText(char, tx, ty + lineHeight - descent);
    }
    const { shadowBlur, shadowOffsetX, shadowOffsetY } = context;
    if (style._fill) {
      if (removeShadow) {
        context.shadowBlur = 0;
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;
      }
      context.fillText(char, tx, ty + lineHeight - descent);
    }
    if (removeShadow) {
      context.shadowBlur = shadowBlur;
      context.shadowOffsetX = shadowOffsetX;
      context.shadowOffsetY = shadowOffsetY;
    }
  }
  destroy() {
    super.destroy();
    for (let i = 0; i < this.pages.length; i++) {
      const { canvasAndContext, texture } = this.pages[i];
      CanvasPool/* CanvasPool */.N.returnCanvasAndContext(canvasAndContext);
      texture.destroy(true);
    }
    this.pages = null;
  }
};
_DynamicBitmapFont.defaultOptions = {
  textureSize: 512,
  style: new TextStyle/* TextStyle */.x(),
  mipmap: true
};
let DynamicBitmapFont = _DynamicBitmapFont;


//# sourceMappingURL=DynamicBitmapFont.mjs.map

;// ./node_modules/pixi.js/lib/scene/text-bitmap/utils/getBitmapTextLayout.mjs

function getBitmapTextLayout(chars, style, font, trimEnd) {
  const layoutData = {
    width: 0,
    height: 0,
    offsetY: 0,
    scale: style.fontSize / font.baseMeasurementFontSize,
    lines: [{
      width: 0,
      charPositions: [],
      spaceWidth: 0,
      spacesIndex: [],
      chars: []
    }]
  };
  layoutData.offsetY = font.baseLineOffset;
  let currentLine = layoutData.lines[0];
  let previousChar = null;
  let firstWord = true;
  const currentWord = {
    spaceWord: false,
    width: 0,
    start: 0,
    index: 0,
    // use index to not modify the array as we use it a lot!
    positions: [],
    chars: []
  };
  const scale = font.baseMeasurementFontSize / style.fontSize;
  const adjustedLetterSpacing = style.letterSpacing * scale;
  const adjustedWordWrapWidth = style.wordWrapWidth * scale;
  const adjustedLineHeight = style.lineHeight ? style.lineHeight * scale : font.lineHeight;
  const breakWords = style.wordWrap && style.breakWords;
  const nextWord = (word) => {
    const start = currentLine.width;
    for (let j = 0; j < currentWord.index; j++) {
      const position = word.positions[j];
      currentLine.chars.push(word.chars[j]);
      currentLine.charPositions.push(position + start);
    }
    currentLine.width += word.width;
    firstWord = false;
    currentWord.width = 0;
    currentWord.index = 0;
    currentWord.chars.length = 0;
  };
  const nextLine = () => {
    let index = currentLine.chars.length - 1;
    if (trimEnd) {
      let lastChar = currentLine.chars[index];
      while (lastChar === " ") {
        currentLine.width -= font.chars[lastChar].xAdvance;
        lastChar = currentLine.chars[--index];
      }
    }
    layoutData.width = Math.max(layoutData.width, currentLine.width);
    currentLine = {
      width: 0,
      charPositions: [],
      chars: [],
      spaceWidth: 0,
      spacesIndex: []
    };
    firstWord = true;
    layoutData.lines.push(currentLine);
    layoutData.height += adjustedLineHeight;
  };
  const checkIsOverflow = (lineWidth) => lineWidth - adjustedLetterSpacing > adjustedWordWrapWidth;
  for (let i = 0; i < chars.length + 1; i++) {
    let char;
    const isEnd = i === chars.length;
    if (!isEnd) {
      char = chars[i];
    }
    const charData = font.chars[char] || font.chars[" "];
    const isSpace = /(?:\s)/.test(char);
    const isWordBreak = isSpace || char === "\r" || char === "\n" || isEnd;
    if (isWordBreak) {
      const addWordToNextLine = !firstWord && style.wordWrap && checkIsOverflow(currentLine.width + currentWord.width);
      if (addWordToNextLine) {
        nextLine();
        nextWord(currentWord);
        if (!isEnd) {
          currentLine.charPositions.push(0);
        }
      } else {
        currentWord.start = currentLine.width;
        nextWord(currentWord);
        if (!isEnd) {
          currentLine.charPositions.push(0);
        }
      }
      if (char === "\r" || char === "\n") {
        nextLine();
      } else if (!isEnd) {
        const spaceWidth = charData.xAdvance + (charData.kerning[previousChar] || 0) + adjustedLetterSpacing;
        currentLine.width += spaceWidth;
        currentLine.spaceWidth = spaceWidth;
        currentLine.spacesIndex.push(currentLine.charPositions.length);
        currentLine.chars.push(char);
      }
    } else {
      const kerning = charData.kerning[previousChar] || 0;
      const nextCharWidth = charData.xAdvance + kerning + adjustedLetterSpacing;
      const addWordToNextLine = breakWords && checkIsOverflow(currentLine.width + currentWord.width + nextCharWidth);
      if (addWordToNextLine) {
        nextWord(currentWord);
        nextLine();
      }
      currentWord.positions[currentWord.index++] = currentWord.width + kerning;
      currentWord.chars.push(char);
      currentWord.width += nextCharWidth;
    }
    previousChar = char;
  }
  nextLine();
  if (style.align === "center") {
    alignCenter(layoutData);
  } else if (style.align === "right") {
    alignRight(layoutData);
  } else if (style.align === "justify") {
    alignJustify(layoutData);
  }
  return layoutData;
}
function alignCenter(measurementData) {
  for (let i = 0; i < measurementData.lines.length; i++) {
    const line = measurementData.lines[i];
    const offset = measurementData.width / 2 - line.width / 2;
    for (let j = 0; j < line.charPositions.length; j++) {
      line.charPositions[j] += offset;
    }
  }
}
function alignRight(measurementData) {
  for (let i = 0; i < measurementData.lines.length; i++) {
    const line = measurementData.lines[i];
    const offset = measurementData.width - line.width;
    for (let j = 0; j < line.charPositions.length; j++) {
      line.charPositions[j] += offset;
    }
  }
}
function alignJustify(measurementData) {
  const width = measurementData.width;
  for (let i = 0; i < measurementData.lines.length; i++) {
    const line = measurementData.lines[i];
    let indy = 0;
    let spaceIndex = line.spacesIndex[indy++];
    let offset = 0;
    const totalSpaces = line.spacesIndex.length;
    const newSpaceWidth = (width - line.width) / totalSpaces;
    const spaceWidth = newSpaceWidth;
    for (let j = 0; j < line.charPositions.length; j++) {
      if (j === spaceIndex) {
        spaceIndex = line.spacesIndex[indy++];
        offset += spaceWidth;
      }
      line.charPositions[j] += offset;
    }
  }
}


//# sourceMappingURL=getBitmapTextLayout.mjs.map

;// ./node_modules/pixi.js/lib/scene/text-bitmap/utils/resolveCharacters.mjs

function resolveCharacters(chars) {
  if (chars === "") {
    return [];
  }
  if (typeof chars === "string") {
    chars = [chars];
  }
  const result = [];
  for (let i = 0, j = chars.length; i < j; i++) {
    const item = chars[i];
    if (Array.isArray(item)) {
      if (item.length !== 2) {
        throw new Error(`[BitmapFont]: Invalid character range length, expecting 2 got ${item.length}.`);
      }
      if (item[0].length === 0 || item[1].length === 0) {
        throw new Error("[BitmapFont]: Invalid character delimiter.");
      }
      const startCode = item[0].charCodeAt(0);
      const endCode = item[1].charCodeAt(0);
      if (endCode < startCode) {
        throw new Error("[BitmapFont]: Invalid character range.");
      }
      for (let i2 = startCode, j2 = endCode; i2 <= j2; i2++) {
        result.push(String.fromCharCode(i2));
      }
    } else {
      result.push(...Array.from(item));
    }
  }
  if (result.length === 0) {
    throw new Error("[BitmapFont]: Empty set when resolving characters.");
  }
  return result;
}


//# sourceMappingURL=resolveCharacters.mjs.map

;// ./node_modules/pixi.js/lib/scene/text-bitmap/BitmapFontManager.mjs










"use strict";
let fontCount = 0;
class BitmapFontManagerClass {
  constructor() {
    /**
     * This character set includes all the letters in the alphabet (both lower- and upper- case).
     * @type {string[][]}
     * @example
     * BitmapFont.from('ExampleFont', style, { chars: BitmapFont.ALPHA })
     */
    this.ALPHA = [["a", "z"], ["A", "Z"], " "];
    /**
     * This character set includes all decimal digits (from 0 to 9).
     * @type {string[][]}
     * @example
     * BitmapFont.from('ExampleFont', style, { chars: BitmapFont.NUMERIC })
     */
    this.NUMERIC = [["0", "9"]];
    /**
     * This character set is the union of `BitmapFont.ALPHA` and `BitmapFont.NUMERIC`.
     * @type {string[][]}
     */
    this.ALPHANUMERIC = [["a", "z"], ["A", "Z"], ["0", "9"], " "];
    /**
     * This character set consists of all the ASCII table.
     * @type {string[][]}
     * @see http://www.asciitable.com/
     */
    this.ASCII = [[" ", "~"]];
    /** Default options for installing a new BitmapFont. */
    this.defaultOptions = {
      chars: this.ALPHANUMERIC,
      resolution: 1,
      padding: 4,
      skipKerning: false,
      textureStyle: null
    };
    /** Cache for measured text layouts to avoid recalculating them multiple times. */
    this.measureCache = (0,tiny_lru/* lru */.g)(1e3);
  }
  /**
   * Get a font for the specified text and style.
   * @param text - The text to get the font for
   * @param style - The style to use
   */
  getFont(text, style) {
    let fontFamilyKey = `${style.fontFamily}-bitmap`;
    let overrideFill = true;
    if (style._fill.fill && !style._stroke) {
      fontFamilyKey += style._fill.fill.styleKey;
      overrideFill = false;
    } else if (style._stroke || style.dropShadow) {
      fontFamilyKey = `${style.styleKey}-bitmap`;
      overrideFill = false;
    }
    if (!Cache/* Cache */.l.has(fontFamilyKey)) {
      const styleCopy = Object.create(style);
      styleCopy.lineHeight = 0;
      const fnt = new DynamicBitmapFont({
        style: styleCopy,
        overrideFill,
        overrideSize: true,
        ...this.defaultOptions
      });
      fontCount++;
      if (fontCount > 50) {
        (0,warn/* warn */.R)("BitmapText", `You have dynamically created ${fontCount} bitmap fonts, this can be inefficient. Try pre installing your font styles using \`BitmapFont.install({name:"style1", style})\``);
      }
      fnt.once("destroy", () => {
        fontCount--;
        Cache/* Cache */.l.remove(fontFamilyKey);
      });
      Cache/* Cache */.l.set(
        fontFamilyKey,
        fnt
      );
    }
    const dynamicFont = Cache/* Cache */.l.get(fontFamilyKey);
    dynamicFont.ensureCharacters?.(text);
    return dynamicFont;
  }
  /**
   * Get the layout of a text for the specified style.
   * @param text - The text to get the layout for
   * @param style - The style to use
   * @param trimEnd - Whether to ignore whitespaces at the end of each line
   */
  getLayout(text, style, trimEnd = true) {
    const bitmapFont = this.getFont(text, style);
    const id = `${text}-${style.styleKey}-${trimEnd}`;
    if (this.measureCache.has(id)) {
      return this.measureCache.get(id);
    }
    const segments = CanvasTextMetrics/* CanvasTextMetrics */.P.graphemeSegmenter(text);
    const layoutData = getBitmapTextLayout(segments, style, bitmapFont, trimEnd);
    this.measureCache.set(id, layoutData);
    return layoutData;
  }
  /**
   * Measure the text using the specified style.
   * @param text - The text to measure
   * @param style - The style to use
   * @param trimEnd - Whether to ignore whitespaces at the end of each line
   */
  measureText(text, style, trimEnd = true) {
    return this.getLayout(text, style, trimEnd);
  }
  // eslint-disable-next-line max-len
  install(...args) {
    let options = args[0];
    if (typeof options === "string") {
      options = {
        name: options,
        style: args[1],
        chars: args[2]?.chars,
        resolution: args[2]?.resolution,
        padding: args[2]?.padding,
        skipKerning: args[2]?.skipKerning
      };
      (0,deprecation/* deprecation */.t6)(deprecation/* v8_0_0 */.lj, "BitmapFontManager.install(name, style, options) is deprecated, use BitmapFontManager.install({name, style, ...options})");
    }
    const name = options?.name;
    if (!name) {
      throw new Error("[BitmapFontManager] Property `name` is required.");
    }
    options = { ...this.defaultOptions, ...options };
    const textStyle = options.style;
    const style = textStyle instanceof TextStyle/* TextStyle */.x ? textStyle : new TextStyle/* TextStyle */.x(textStyle);
    const overrideFill = options.dynamicFill ?? this._canUseTintForStyle(style);
    const font = new DynamicBitmapFont({
      style,
      overrideFill,
      skipKerning: options.skipKerning,
      padding: options.padding,
      resolution: options.resolution,
      overrideSize: false,
      textureStyle: options.textureStyle
    });
    const flatChars = resolveCharacters(options.chars);
    font.ensureCharacters(flatChars.join(""));
    Cache/* Cache */.l.set(`${name}-bitmap`, font);
    font.once("destroy", () => Cache/* Cache */.l.remove(`${name}-bitmap`));
    return font;
  }
  /**
   * Uninstalls a bitmap font from the cache.
   * @param {string} name - The name of the bitmap font to uninstall.
   */
  uninstall(name) {
    const cacheKey = `${name}-bitmap`;
    const font = Cache/* Cache */.l.get(cacheKey);
    if (font) {
      font.destroy();
    }
  }
  /**
   * Determines if a style can use tinting instead of baking colors into the bitmap.
   * Tinting is more efficient as it allows reusing the same bitmap with different colors.
   * @param style - The text style to evaluate
   * @returns true if the style can use tinting, false if colors must be baked in
   * @private
   */
  _canUseTintForStyle(style) {
    return !style._stroke && (!style.dropShadow || style.dropShadow.color === 0) && !style._fill.fill && style._fill.color === 16777215;
  }
}
const BitmapFontManager = new BitmapFontManagerClass();


//# sourceMappingURL=BitmapFontManager.mjs.map

;// ./node_modules/pixi.js/lib/scene/text-bitmap/BitmapTextPipe.mjs








"use strict";
class BitmapTextGraphics extends Graphics {
  destroy() {
    if (this.context.customShader) {
      this.context.customShader.destroy();
    }
    super.destroy();
  }
}
class BitmapTextPipe {
  constructor(renderer) {
    this._renderer = renderer;
  }
  validateRenderable(bitmapText) {
    const graphicsRenderable = this._getGpuBitmapText(bitmapText);
    return this._renderer.renderPipes.graphics.validateRenderable(graphicsRenderable);
  }
  addRenderable(bitmapText, instructionSet) {
    const graphicsRenderable = this._getGpuBitmapText(bitmapText);
    syncWithProxy(bitmapText, graphicsRenderable);
    if (bitmapText._didTextUpdate) {
      bitmapText._didTextUpdate = false;
      this._updateContext(bitmapText, graphicsRenderable);
    }
    this._renderer.renderPipes.graphics.addRenderable(graphicsRenderable, instructionSet);
    if (graphicsRenderable.context.customShader) {
      this._updateDistanceField(bitmapText);
    }
  }
  updateRenderable(bitmapText) {
    const graphicsRenderable = this._getGpuBitmapText(bitmapText);
    syncWithProxy(bitmapText, graphicsRenderable);
    this._renderer.renderPipes.graphics.updateRenderable(graphicsRenderable);
    if (graphicsRenderable.context.customShader) {
      this._updateDistanceField(bitmapText);
    }
  }
  _updateContext(bitmapText, proxyGraphics) {
    const { context } = proxyGraphics;
    const bitmapFont = BitmapFontManager.getFont(bitmapText.text, bitmapText._style);
    context.clear();
    if (bitmapFont.distanceField.type !== "none") {
      if (!context.customShader) {
        context.customShader = new SdfShader(this._renderer.limits.maxBatchableTextures);
      }
    }
    const chars = CanvasTextMetrics/* CanvasTextMetrics */.P.graphemeSegmenter(bitmapText.text);
    const style = bitmapText._style;
    let currentY = bitmapFont.baseLineOffset;
    const bitmapTextLayout = getBitmapTextLayout(chars, style, bitmapFont, true);
    const padding = style.padding;
    const scale = bitmapTextLayout.scale;
    let tx = bitmapTextLayout.width;
    let ty = bitmapTextLayout.height + bitmapTextLayout.offsetY;
    if (style._stroke) {
      tx += style._stroke.width / scale;
      ty += style._stroke.width / scale;
    }
    context.translate(-bitmapText._anchor._x * tx - padding, -bitmapText._anchor._y * ty - padding).scale(scale, scale);
    const tint = bitmapFont.applyFillAsTint ? style._fill.color : 16777215;
    let fontSize = bitmapFont.fontMetrics.fontSize;
    let lineHeight = bitmapFont.lineHeight;
    if (style.lineHeight) {
      fontSize = style.fontSize / scale;
      lineHeight = style.lineHeight / scale;
    }
    let linePositionYShift = (lineHeight - fontSize) / 2;
    if (linePositionYShift - bitmapFont.baseLineOffset < 0) {
      linePositionYShift = 0;
    }
    for (let i = 0; i < bitmapTextLayout.lines.length; i++) {
      const line = bitmapTextLayout.lines[i];
      for (let j = 0; j < line.charPositions.length; j++) {
        const char = line.chars[j];
        const charData = bitmapFont.chars[char];
        if (charData?.texture) {
          const texture = charData.texture;
          context.texture(
            texture,
            tint ? tint : "black",
            Math.round(line.charPositions[j] + charData.xOffset),
            Math.round(currentY + charData.yOffset + linePositionYShift),
            texture.orig.width,
            texture.orig.height
          );
        }
      }
      currentY += lineHeight;
    }
  }
  _getGpuBitmapText(bitmapText) {
    return bitmapText._gpuData[this._renderer.uid] || this.initGpuText(bitmapText);
  }
  initGpuText(bitmapText) {
    const proxyRenderable = new BitmapTextGraphics();
    bitmapText._gpuData[this._renderer.uid] = proxyRenderable;
    this._updateContext(bitmapText, proxyRenderable);
    return proxyRenderable;
  }
  _updateDistanceField(bitmapText) {
    const context = this._getGpuBitmapText(bitmapText).context;
    const fontFamily = bitmapText._style.fontFamily;
    const dynamicFont = Cache/* Cache */.l.get(`${fontFamily}-bitmap`);
    const { a, b, c, d } = bitmapText.groupTransform;
    const dx = Math.sqrt(a * a + b * b);
    const dy = Math.sqrt(c * c + d * d);
    const worldScale = (Math.abs(dx) + Math.abs(dy)) / 2;
    const fontScale = dynamicFont.baseRenderedFontSize / bitmapText._style.fontSize;
    const distance = worldScale * dynamicFont.distanceField.range * (1 / fontScale);
    context.customShader.resources.localUniforms.uniforms.uDistance = distance;
  }
  destroy() {
    this._renderer = null;
  }
}
/** @ignore */
BitmapTextPipe.extension = {
  type: [
    Extensions/* ExtensionType */.Ag.WebGLPipes,
    Extensions/* ExtensionType */.Ag.WebGPUPipes,
    Extensions/* ExtensionType */.Ag.CanvasPipes
  ],
  name: "bitmapText"
};
function syncWithProxy(container, proxy) {
  proxy.groupTransform = container.groupTransform;
  proxy.groupColorAlpha = container.groupColorAlpha;
  proxy.groupColor = container.groupColor;
  proxy.groupBlendMode = container.groupBlendMode;
  proxy.globalDisplayStatus = container.globalDisplayStatus;
  proxy.groupTransform = container.groupTransform;
  proxy.localDisplayStatus = container.localDisplayStatus;
  proxy.groupAlpha = container.groupAlpha;
  proxy._roundPixels = container._roundPixels;
}


//# sourceMappingURL=BitmapTextPipe.mjs.map

;// ./node_modules/pixi.js/lib/scene/text-bitmap/init.mjs



"use strict";
Extensions/* extensions */.XO.add(BitmapTextPipe);
//# sourceMappingURL=init.mjs.map


/***/ },

/***/ 7340
(__unused_webpack___webpack_module__, __unused_webpack___webpack_exports__, __webpack_require__) {

"use strict";

// EXTERNAL MODULE: ./node_modules/pixi.js/lib/extensions/Extensions.mjs
var Extensions = __webpack_require__(8507);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/texture/Texture.mjs + 2 modules
var Texture = __webpack_require__(226);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/text/utils/updateTextBounds.mjs
var updateTextBounds = __webpack_require__(2289);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/sprite/BatchableSprite.mjs
var BatchableSprite = __webpack_require__(8422);
;// ./node_modules/pixi.js/lib/scene/text-html/BatchableHTMLText.mjs


"use strict";
class BatchableHTMLText extends BatchableSprite/* BatchableSprite */.K {
  /**
   * Creates an instance of BatchableHTMLText.
   * @param renderer - The renderer instance to be used.
   */
  constructor(renderer) {
    super();
    this.generatingTexture = false;
    this.currentKey = "--";
    this._renderer = renderer;
    renderer.runners.resolutionChange.add(this);
  }
  /** Handles resolution changes for the HTML text. If the text has auto resolution enabled, it triggers a view update. */
  resolutionChange() {
    const text = this.renderable;
    if (text._autoResolution) {
      text.onViewUpdate();
    }
  }
  /** Destroys the BatchableHTMLText instance. Returns the texture promise to the renderer and cleans up references. */
  destroy() {
    const { htmlText } = this._renderer;
    htmlText.getReferenceCount(this.currentKey) === null ? htmlText.returnTexturePromise(this.texturePromise) : htmlText.decreaseReferenceCount(this.currentKey);
    this._renderer.runners.resolutionChange.remove(this);
    this.texturePromise = null;
    this._renderer = null;
  }
}


//# sourceMappingURL=BatchableHTMLText.mjs.map

;// ./node_modules/pixi.js/lib/scene/text-html/HTMLTextPipe.mjs





"use strict";
class HTMLTextPipe {
  constructor(renderer) {
    this._renderer = renderer;
  }
  validateRenderable(htmlText) {
    const gpuText = this._getGpuText(htmlText);
    const newKey = htmlText.styleKey;
    if (gpuText.currentKey !== newKey) {
      return true;
    }
    return false;
  }
  addRenderable(htmlText, instructionSet) {
    const batchableHTMLText = this._getGpuText(htmlText);
    if (htmlText._didTextUpdate) {
      const resolution = htmlText._autoResolution ? this._renderer.resolution : htmlText.resolution;
      if (batchableHTMLText.currentKey !== htmlText.styleKey || htmlText.resolution !== resolution) {
        this._updateGpuText(htmlText).catch((e) => {
          console.error(e);
        });
      }
      htmlText._didTextUpdate = false;
      (0,updateTextBounds/* updateTextBounds */.s)(batchableHTMLText, htmlText);
    }
    this._renderer.renderPipes.batch.addToBatch(batchableHTMLText, instructionSet);
  }
  updateRenderable(htmlText) {
    const batchableHTMLText = this._getGpuText(htmlText);
    batchableHTMLText._batcher.updateElement(batchableHTMLText);
  }
  async _updateGpuText(htmlText) {
    htmlText._didTextUpdate = false;
    const batchableHTMLText = this._getGpuText(htmlText);
    if (batchableHTMLText.generatingTexture)
      return;
    const oldTexturePromise = batchableHTMLText.texturePromise;
    batchableHTMLText.texturePromise = null;
    batchableHTMLText.generatingTexture = true;
    htmlText._resolution = htmlText._autoResolution ? this._renderer.resolution : htmlText.resolution;
    let texturePromise = this._renderer.htmlText.getTexturePromise(htmlText);
    if (oldTexturePromise) {
      texturePromise = texturePromise.finally(() => {
        this._renderer.htmlText.decreaseReferenceCount(batchableHTMLText.currentKey);
        this._renderer.htmlText.returnTexturePromise(oldTexturePromise);
      });
    }
    batchableHTMLText.texturePromise = texturePromise;
    batchableHTMLText.currentKey = htmlText.styleKey;
    batchableHTMLText.texture = await texturePromise;
    const renderGroup = htmlText.renderGroup || htmlText.parentRenderGroup;
    if (renderGroup) {
      renderGroup.structureDidChange = true;
    }
    batchableHTMLText.generatingTexture = false;
    (0,updateTextBounds/* updateTextBounds */.s)(batchableHTMLText, htmlText);
  }
  _getGpuText(htmlText) {
    return htmlText._gpuData[this._renderer.uid] || this.initGpuText(htmlText);
  }
  initGpuText(htmlText) {
    const batchableHTMLText = new BatchableHTMLText(this._renderer);
    batchableHTMLText.renderable = htmlText;
    batchableHTMLText.transform = htmlText.groupTransform;
    batchableHTMLText.texture = Texture/* Texture */.g.EMPTY;
    batchableHTMLText.bounds = { minX: 0, maxX: 1, minY: 0, maxY: 0 };
    batchableHTMLText.roundPixels = this._renderer._roundPixels | htmlText._roundPixels;
    htmlText._resolution = htmlText._autoResolution ? this._renderer.resolution : htmlText.resolution;
    htmlText._gpuData[this._renderer.uid] = batchableHTMLText;
    return batchableHTMLText;
  }
  destroy() {
    this._renderer = null;
  }
}
/** @ignore */
HTMLTextPipe.extension = {
  type: [
    Extensions/* ExtensionType */.Ag.WebGLPipes,
    Extensions/* ExtensionType */.Ag.WebGPUPipes,
    Extensions/* ExtensionType */.Ag.CanvasPipes
  ],
  name: "htmlText"
};


//# sourceMappingURL=HTMLTextPipe.mjs.map

// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/texture/CanvasPool.mjs
var CanvasPool = __webpack_require__(7608);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/texture/TexturePool.mjs
var TexturePool = __webpack_require__(2437);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/types.mjs
var types = __webpack_require__(5099);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/environment/adapter.mjs + 1 modules
var adapter = __webpack_require__(6559);
;// ./node_modules/pixi.js/lib/utils/browser/isSafari.mjs


"use strict";
function isSafari() {
  const { userAgent } = adapter/* DOMAdapter */.e.get().getNavigator();
  return /^((?!chrome|android).)*safari/i.test(userAgent);
}


//# sourceMappingURL=isSafari.mjs.map

// EXTERNAL MODULE: ./node_modules/pixi.js/lib/utils/logging/warn.mjs
var warn = __webpack_require__(268);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/utils/pool/PoolGroup.mjs + 1 modules
var PoolGroup = __webpack_require__(1822);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/text/utils/getPo2TextureFromSource.mjs
var getPo2TextureFromSource = __webpack_require__(2558);
;// ./node_modules/pixi.js/lib/scene/text-html/HTMLTextRenderData.mjs


"use strict";
const nssvg = "http://www.w3.org/2000/svg";
const nsxhtml = "http://www.w3.org/1999/xhtml";
class HTMLTextRenderData {
  constructor() {
    this.svgRoot = document.createElementNS(nssvg, "svg");
    this.foreignObject = document.createElementNS(nssvg, "foreignObject");
    this.domElement = document.createElementNS(nsxhtml, "div");
    this.styleElement = document.createElementNS(nsxhtml, "style");
    const { foreignObject, svgRoot, styleElement, domElement } = this;
    foreignObject.setAttribute("width", "10000");
    foreignObject.setAttribute("height", "10000");
    foreignObject.style.overflow = "hidden";
    svgRoot.appendChild(foreignObject);
    foreignObject.appendChild(styleElement);
    foreignObject.appendChild(domElement);
    this.image = adapter/* DOMAdapter */.e.get().createImage();
  }
  destroy() {
    this.svgRoot.remove();
    this.foreignObject.remove();
    this.styleElement.remove();
    this.domElement.remove();
    this.image.src = "";
    this.image.remove();
    this.svgRoot = null;
    this.foreignObject = null;
    this.styleElement = null;
    this.domElement = null;
    this.image = null;
    this.canvasAndContext = null;
  }
}


//# sourceMappingURL=HTMLTextRenderData.mjs.map

;// ./node_modules/pixi.js/lib/scene/text-html/utils/extractFontFamilies.mjs

function extractFontFamilies(text, style) {
  const fontFamily = style.fontFamily;
  const fontFamilies = [];
  const dedupe = {};
  const regex = /font-family:([^;"\s]+)/g;
  const matches = text.match(regex);
  function addFontFamily(fontFamily2) {
    if (!dedupe[fontFamily2]) {
      fontFamilies.push(fontFamily2);
      dedupe[fontFamily2] = true;
    }
  }
  if (Array.isArray(fontFamily)) {
    for (let i = 0; i < fontFamily.length; i++) {
      addFontFamily(fontFamily[i]);
    }
  } else {
    addFontFamily(fontFamily);
  }
  if (matches) {
    matches.forEach((match) => {
      const fontFamily2 = match.split(":")[1].trim();
      addFontFamily(fontFamily2);
    });
  }
  for (const i in style.tagStyles) {
    const fontFamily2 = style.tagStyles[i].fontFamily;
    addFontFamily(fontFamily2);
  }
  return fontFamilies;
}


//# sourceMappingURL=extractFontFamilies.mjs.map

// EXTERNAL MODULE: ./node_modules/pixi.js/lib/assets/cache/Cache.mjs
var Cache = __webpack_require__(1979);
;// ./node_modules/pixi.js/lib/scene/text-html/utils/loadFontAsBase64.mjs


"use strict";
async function loadFontAsBase64(url) {
  const response = await adapter/* DOMAdapter */.e.get().fetch(url);
  const blob = await response.blob();
  const reader = new FileReader();
  const dataSrc = await new Promise((resolve, reject) => {
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return dataSrc;
}


//# sourceMappingURL=loadFontAsBase64.mjs.map

;// ./node_modules/pixi.js/lib/scene/text-html/utils/loadFontCSS.mjs


"use strict";
async function loadFontCSS(style, url) {
  const dataSrc = await loadFontAsBase64(url);
  return `@font-face {
        font-family: "${style.fontFamily}";
        font-weight: ${style.fontWeight};
        font-style: ${style.fontStyle};
        src: url('${dataSrc}');
    }`;
}


//# sourceMappingURL=loadFontCSS.mjs.map

;// ./node_modules/pixi.js/lib/scene/text-html/utils/getFontCss.mjs



"use strict";
const FontStylePromiseCache = /* @__PURE__ */ new Map();
async function getFontCss(fontFamilies) {
  const fontPromises = fontFamilies.filter((fontFamily) => Cache/* Cache */.l.has(`${fontFamily}-and-url`)).map((fontFamily) => {
    if (!FontStylePromiseCache.has(fontFamily)) {
      const { entries } = Cache/* Cache */.l.get(`${fontFamily}-and-url`);
      const promises = [];
      entries.forEach((entry) => {
        const url = entry.url;
        const faces = entry.faces;
        const out = faces.map((face) => ({ weight: face.weight, style: face.style }));
        promises.push(
          ...out.map(
            (style) => loadFontCSS(
              {
                fontWeight: style.weight,
                fontStyle: style.style,
                fontFamily
              },
              url
            )
          )
        );
      });
      FontStylePromiseCache.set(
        fontFamily,
        Promise.all(promises).then((css) => css.join("\n"))
      );
    }
    return FontStylePromiseCache.get(fontFamily);
  });
  return (await Promise.all(fontPromises)).join("\n");
}


//# sourceMappingURL=getFontCss.mjs.map

;// ./node_modules/pixi.js/lib/scene/text-html/utils/getSVGUrl.mjs

function getSVGUrl(text, style, resolution, fontCSS, htmlTextData) {
  const { domElement, styleElement, svgRoot } = htmlTextData;
  domElement.innerHTML = `<style>${style.cssStyle}</style><div style='padding:0;'>${text}</div>`;
  domElement.setAttribute("style", `transform: scale(${resolution});transform-origin: top left; display: inline-block`);
  styleElement.textContent = fontCSS;
  const { width, height } = htmlTextData.image;
  svgRoot.setAttribute("width", width.toString());
  svgRoot.setAttribute("height", height.toString());
  return new XMLSerializer().serializeToString(svgRoot);
}


//# sourceMappingURL=getSVGUrl.mjs.map

;// ./node_modules/pixi.js/lib/scene/text-html/utils/getTemporaryCanvasFromImage.mjs


"use strict";
function getTemporaryCanvasFromImage(image, resolution) {
  const canvasAndContext = CanvasPool/* CanvasPool */.N.getOptimalCanvasAndContext(
    image.width,
    image.height,
    resolution
  );
  const { context } = canvasAndContext;
  context.clearRect(0, 0, image.width, image.height);
  context.drawImage(image, 0, 0);
  return canvasAndContext;
}


//# sourceMappingURL=getTemporaryCanvasFromImage.mjs.map

;// ./node_modules/pixi.js/lib/scene/text-html/utils/loadSVGImage.mjs

function loadSVGImage(image, url, delay) {
  return new Promise(async (resolve) => {
    if (delay) {
      await new Promise((resolve2) => setTimeout(resolve2, 100));
    }
    image.onload = () => {
      resolve();
    };
    image.src = `data:image/svg+xml;charset=utf8,${encodeURIComponent(url)}`;
    image.crossOrigin = "anonymous";
  });
}


//# sourceMappingURL=loadSVGImage.mjs.map

;// ./node_modules/pixi.js/lib/scene/text-html/utils/measureHtmlText.mjs


"use strict";
let tempHTMLTextRenderData;
function measureHtmlText(text, style, fontStyleCSS, htmlTextRenderData) {
  htmlTextRenderData || (htmlTextRenderData = tempHTMLTextRenderData || (tempHTMLTextRenderData = new HTMLTextRenderData()));
  const { domElement, styleElement, svgRoot } = htmlTextRenderData;
  domElement.innerHTML = `<style>${style.cssStyle};</style><div style='padding:0'>${text}</div>`;
  domElement.setAttribute("style", "transform-origin: top left; display: inline-block");
  if (fontStyleCSS) {
    styleElement.textContent = fontStyleCSS;
  }
  document.body.appendChild(svgRoot);
  const contentBounds = domElement.getBoundingClientRect();
  svgRoot.remove();
  const doublePadding = style.padding * 2;
  return {
    width: contentBounds.width - doublePadding,
    height: contentBounds.height - doublePadding
  };
}


//# sourceMappingURL=measureHtmlText.mjs.map

;// ./node_modules/pixi.js/lib/scene/text-html/HTMLTextSystem.mjs
















"use strict";
class HTMLTextSystem {
  constructor(renderer) {
    this._activeTextures = {};
    this._renderer = renderer;
    this._createCanvas = renderer.type === types/* RendererType */.W.WEBGPU;
  }
  /**
   * @param options
   * @deprecated Use getTexturePromise instead
   */
  getTexture(options) {
    return this.getTexturePromise(options);
  }
  /**
   * Increases the reference count for a texture.
   * @param text - The HTMLText instance associated with the texture.
   */
  getManagedTexture(text) {
    const textKey = text.styleKey;
    if (this._activeTextures[textKey]) {
      this._increaseReferenceCount(textKey);
      return this._activeTextures[textKey].promise;
    }
    const promise = this._buildTexturePromise(text).then((texture) => {
      this._activeTextures[textKey].texture = texture;
      return texture;
    });
    this._activeTextures[textKey] = {
      texture: null,
      promise,
      usageCount: 1
    };
    return promise;
  }
  /**
   * Gets the current reference count for a texture associated with a text key.
   * @param textKey - The unique key identifying the text style configuration
   * @returns The number of Text instances currently using this texture
   */
  getReferenceCount(textKey) {
    return this._activeTextures[textKey]?.usageCount ?? null;
  }
  _increaseReferenceCount(textKey) {
    this._activeTextures[textKey].usageCount++;
  }
  /**
   * Decreases the reference count for a texture.
   * If the count reaches zero, the texture is cleaned up.
   * @param textKey - The key associated with the HTMLText instance.
   */
  decreaseReferenceCount(textKey) {
    const activeTexture = this._activeTextures[textKey];
    if (!activeTexture)
      return;
    activeTexture.usageCount--;
    if (activeTexture.usageCount === 0) {
      if (activeTexture.texture) {
        this._cleanUp(activeTexture.texture);
      } else {
        activeTexture.promise.then((texture) => {
          activeTexture.texture = texture;
          this._cleanUp(activeTexture.texture);
        }).catch(() => {
          (0,warn/* warn */.R)("HTMLTextSystem: Failed to clean texture");
        });
      }
      this._activeTextures[textKey] = null;
    }
  }
  /**
   * Returns a promise that resolves to a texture for the given HTMLText options.
   * @param options - The options for the HTMLText.
   * @returns A promise that resolves to a Texture.
   */
  getTexturePromise(options) {
    return this._buildTexturePromise(options);
  }
  async _buildTexturePromise(options) {
    const { text, style, resolution, textureStyle } = options;
    const htmlTextData = PoolGroup/* BigPool */.Z.get(HTMLTextRenderData);
    const fontFamilies = extractFontFamilies(text, style);
    const fontCSS = await getFontCss(fontFamilies);
    const measured = measureHtmlText(text, style, fontCSS, htmlTextData);
    const width = Math.ceil(Math.ceil(Math.max(1, measured.width) + style.padding * 2) * resolution);
    const height = Math.ceil(Math.ceil(Math.max(1, measured.height) + style.padding * 2) * resolution);
    const image = htmlTextData.image;
    const uvSafeOffset = 2;
    image.width = (width | 0) + uvSafeOffset;
    image.height = (height | 0) + uvSafeOffset;
    const svgURL = getSVGUrl(text, style, resolution, fontCSS, htmlTextData);
    await loadSVGImage(image, svgURL, isSafari() && fontFamilies.length > 0);
    const resource = image;
    let canvasAndContext;
    if (this._createCanvas) {
      canvasAndContext = getTemporaryCanvasFromImage(image, resolution);
    }
    const texture = (0,getPo2TextureFromSource/* getPo2TextureFromSource */.M)(
      canvasAndContext ? canvasAndContext.canvas : resource,
      image.width - uvSafeOffset,
      image.height - uvSafeOffset,
      resolution
    );
    if (textureStyle)
      texture.source.style = textureStyle;
    if (this._createCanvas) {
      this._renderer.texture.initSource(texture.source);
      CanvasPool/* CanvasPool */.N.returnCanvasAndContext(canvasAndContext);
    }
    PoolGroup/* BigPool */.Z.return(htmlTextData);
    return texture;
  }
  returnTexturePromise(texturePromise) {
    texturePromise.then((texture) => {
      this._cleanUp(texture);
    }).catch(() => {
      (0,warn/* warn */.R)("HTMLTextSystem: Failed to clean texture");
    });
  }
  _cleanUp(texture) {
    TexturePool/* TexturePool */.W.returnTexture(texture, true);
    texture.source.resource = null;
    texture.source.uploadMethodId = "unknown";
  }
  destroy() {
    this._renderer = null;
    for (const key in this._activeTextures) {
      if (this._activeTextures[key])
        this.returnTexturePromise(this._activeTextures[key].promise);
    }
    this._activeTextures = null;
  }
}
/** @ignore */
HTMLTextSystem.extension = {
  type: [
    Extensions/* ExtensionType */.Ag.WebGLSystem,
    Extensions/* ExtensionType */.Ag.WebGPUSystem,
    Extensions/* ExtensionType */.Ag.CanvasSystem
  ],
  name: "htmlText"
};


//# sourceMappingURL=HTMLTextSystem.mjs.map

;// ./node_modules/pixi.js/lib/scene/text-html/init.mjs




"use strict";
Extensions/* extensions */.XO.add(HTMLTextSystem);
Extensions/* extensions */.XO.add(HTMLTextPipe);
//# sourceMappingURL=init.mjs.map


/***/ },

/***/ 8291
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   x: () => (/* binding */ TextStyle)
/* harmony export */ });
/* harmony import */ var eventemitter3__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4486);
/* harmony import */ var _color_Color_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3556);
/* harmony import */ var _utils_data_uid_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(133);
/* harmony import */ var _utils_logging_deprecation_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4670);
/* harmony import */ var _utils_logging_warn_mjs__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(268);
/* harmony import */ var _graphics_shared_fill_FillGradient_mjs__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(7276);
/* harmony import */ var _graphics_shared_fill_FillPattern_mjs__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(2806);
/* harmony import */ var _graphics_shared_GraphicsContext_mjs__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(9516);
/* harmony import */ var _graphics_shared_utils_convertFillInputToFillStyle_mjs__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(990);










"use strict";
const _TextStyle = class _TextStyle extends eventemitter3__WEBPACK_IMPORTED_MODULE_0__/* ["default"] */ .A {
  constructor(style = {}) {
    super();
    /**
     * Unique identifier for the TextStyle class.
     * This is used to track instances and ensure uniqueness.
     * @internal
     */
    this.uid = (0,_utils_data_uid_mjs__WEBPACK_IMPORTED_MODULE_2__/* .uid */ .L)("textStyle");
    /**
     * Internal tick counter used to track updates and changes.
     * This is incremented whenever the style is modified, allowing for efficient change detection.
     * @internal
     */
    this._tick = 0;
    convertV7Tov8Style(style);
    const fullStyle = { ..._TextStyle.defaultTextStyle, ...style };
    for (const key in fullStyle) {
      const thisKey = key;
      this[thisKey] = fullStyle[key];
    }
    this.update();
    this._tick = 0;
  }
  /**
   * Alignment for multiline text, does not affect single line text.
   * @type {'left'|'center'|'right'|'justify'}
   */
  get align() {
    return this._align;
  }
  set align(value) {
    if (this._align === value)
      return;
    this._align = value;
    this.update();
  }
  /** Indicates if lines can be wrapped within words, it needs wordWrap to be set to true. */
  get breakWords() {
    return this._breakWords;
  }
  set breakWords(value) {
    if (this._breakWords === value)
      return;
    this._breakWords = value;
    this.update();
  }
  /** Set a drop shadow for the text. */
  get dropShadow() {
    return this._dropShadow;
  }
  set dropShadow(value) {
    if (this._dropShadow === value)
      return;
    if (value !== null && typeof value === "object") {
      this._dropShadow = this._createProxy({ ..._TextStyle.defaultDropShadow, ...value });
    } else {
      this._dropShadow = value ? this._createProxy({ ..._TextStyle.defaultDropShadow }) : null;
    }
    this.update();
  }
  /** The font family, can be a single font name, or a list of names where the first is the preferred font. */
  get fontFamily() {
    return this._fontFamily;
  }
  set fontFamily(value) {
    if (this._fontFamily === value)
      return;
    this._fontFamily = value;
    this.update();
  }
  /** The font size (as a number it converts to px, but as a string, equivalents are '26px','20pt','160%' or '1.6em') */
  get fontSize() {
    return this._fontSize;
  }
  set fontSize(value) {
    if (this._fontSize === value)
      return;
    if (typeof value === "string") {
      this._fontSize = parseInt(value, 10);
    } else {
      this._fontSize = value;
    }
    this.update();
  }
  /**
   * The font style.
   * @type {'normal'|'italic'|'oblique'}
   */
  get fontStyle() {
    return this._fontStyle;
  }
  set fontStyle(value) {
    if (this._fontStyle === value)
      return;
    this._fontStyle = value.toLowerCase();
    this.update();
  }
  /**
   * The font variant.
   * @type {'normal'|'small-caps'}
   */
  get fontVariant() {
    return this._fontVariant;
  }
  set fontVariant(value) {
    if (this._fontVariant === value)
      return;
    this._fontVariant = value;
    this.update();
  }
  /**
   * The font weight.
   * @type {'normal'|'bold'|'bolder'|'lighter'|'100'|'200'|'300'|'400'|'500'|'600'|'700'|'800'|'900'}
   */
  get fontWeight() {
    return this._fontWeight;
  }
  set fontWeight(value) {
    if (this._fontWeight === value)
      return;
    this._fontWeight = value;
    this.update();
  }
  /** The space between lines. */
  get leading() {
    return this._leading;
  }
  set leading(value) {
    if (this._leading === value)
      return;
    this._leading = value;
    this.update();
  }
  /** The amount of spacing between letters, default is 0. */
  get letterSpacing() {
    return this._letterSpacing;
  }
  set letterSpacing(value) {
    if (this._letterSpacing === value)
      return;
    this._letterSpacing = value;
    this.update();
  }
  /** The line height, a number that represents the vertical space that a letter uses. */
  get lineHeight() {
    return this._lineHeight;
  }
  set lineHeight(value) {
    if (this._lineHeight === value)
      return;
    this._lineHeight = value;
    this.update();
  }
  /**
   * Occasionally some fonts are cropped. Adding some padding will prevent this from happening
   * by adding padding to all sides of the text.
   * > [!NOTE] This will NOT affect the positioning or bounds of the text.
   */
  get padding() {
    return this._padding;
  }
  set padding(value) {
    if (this._padding === value)
      return;
    this._padding = value;
    this.update();
  }
  /**
   * An optional filter or array of filters to apply to the text, allowing for advanced visual effects.
   * These filters will be applied to the text as it is created, resulting in faster rendering for static text
   * compared to applying the filter directly to the text object (which would be applied at run time).
   * @default null
   */
  get filters() {
    return this._filters;
  }
  set filters(value) {
    if (this._filters === value)
      return;
    this._filters = Object.freeze(value);
    this.update();
  }
  /**
   * Trim transparent borders from the text texture.
   * > [!IMPORTANT] PERFORMANCE WARNING:
   * > This is a costly operation as it requires scanning pixel alpha values.
   * > Avoid using `trim: true` for dynamic text, as it could significantly impact performance.
   */
  get trim() {
    return this._trim;
  }
  set trim(value) {
    if (this._trim === value)
      return;
    this._trim = value;
    this.update();
  }
  /**
   * The baseline of the text that is rendered.
   * @type {'alphabetic'|'top'|'hanging'|'middle'|'ideographic'|'bottom'}
   */
  get textBaseline() {
    return this._textBaseline;
  }
  set textBaseline(value) {
    if (this._textBaseline === value)
      return;
    this._textBaseline = value;
    this.update();
  }
  /**
   * How newlines and spaces should be handled.
   * Default is 'pre' (preserve, preserve).
   *
   *  value       | New lines     |   Spaces
   *  ---         | ---           |   ---
   * 'normal'     | Collapse      |   Collapse
   * 'pre'        | Preserve      |   Preserve
   * 'pre-line'   | Preserve      |   Collapse
   * @type {'normal'|'pre'|'pre-line'}
   */
  get whiteSpace() {
    return this._whiteSpace;
  }
  set whiteSpace(value) {
    if (this._whiteSpace === value)
      return;
    this._whiteSpace = value;
    this.update();
  }
  /** Indicates if word wrap should be used. */
  get wordWrap() {
    return this._wordWrap;
  }
  set wordWrap(value) {
    if (this._wordWrap === value)
      return;
    this._wordWrap = value;
    this.update();
  }
  /** The width at which text will wrap, it needs wordWrap to be set to true. */
  get wordWrapWidth() {
    return this._wordWrapWidth;
  }
  set wordWrapWidth(value) {
    if (this._wordWrapWidth === value)
      return;
    this._wordWrapWidth = value;
    this.update();
  }
  /**
   * The fill style that will be used to color the text.
   * This can be:
   * - A color string like 'red', '#00FF00', or 'rgba(255,0,0,0.5)'
   * - A hex number like 0xff0000 for red
   * - A FillStyle object with properties like { color: 0xff0000, alpha: 0.5 }
   * - A FillGradient for gradient fills
   * - A FillPattern for pattern/texture fills
   *
   * When using a FillGradient, vertical gradients (angle of 90 degrees) are applied per line of text,
   * while gradients at any other angle are spread across the entire text body as a whole.
   * @example
   * // Vertical gradient applied per line
   * const verticalGradient = new FillGradient(0, 0, 0, 1)
   *     .addColorStop(0, 0xff0000)
   *     .addColorStop(1, 0x0000ff);
   *
   * const text = new Text({
   *     text: 'Line 1\nLine 2',
   *     style: { fill: verticalGradient }
   * });
   *
   * To manage the gradient in a global scope, set the textureSpace property of the FillGradient to 'global'.
   * @type {string|number|FillStyle|FillGradient|FillPattern}
   */
  get fill() {
    return this._originalFill;
  }
  set fill(value) {
    if (value === this._originalFill)
      return;
    this._originalFill = value;
    if (this._isFillStyle(value)) {
      this._originalFill = this._createProxy({ ..._graphics_shared_GraphicsContext_mjs__WEBPACK_IMPORTED_MODULE_7__/* .GraphicsContext */ .T.defaultFillStyle, ...value }, () => {
        this._fill = (0,_graphics_shared_utils_convertFillInputToFillStyle_mjs__WEBPACK_IMPORTED_MODULE_8__/* .toFillStyle */ .w)(
          { ...this._originalFill },
          _graphics_shared_GraphicsContext_mjs__WEBPACK_IMPORTED_MODULE_7__/* .GraphicsContext */ .T.defaultFillStyle
        );
      });
    }
    this._fill = (0,_graphics_shared_utils_convertFillInputToFillStyle_mjs__WEBPACK_IMPORTED_MODULE_8__/* .toFillStyle */ .w)(
      value === 0 ? "black" : value,
      _graphics_shared_GraphicsContext_mjs__WEBPACK_IMPORTED_MODULE_7__/* .GraphicsContext */ .T.defaultFillStyle
    );
    this.update();
  }
  /** A fillstyle that will be used on the text stroke, e.g., 'blue', '#FCFF00'. */
  get stroke() {
    return this._originalStroke;
  }
  set stroke(value) {
    if (value === this._originalStroke)
      return;
    this._originalStroke = value;
    if (this._isFillStyle(value)) {
      this._originalStroke = this._createProxy({ ..._graphics_shared_GraphicsContext_mjs__WEBPACK_IMPORTED_MODULE_7__/* .GraphicsContext */ .T.defaultStrokeStyle, ...value }, () => {
        this._stroke = (0,_graphics_shared_utils_convertFillInputToFillStyle_mjs__WEBPACK_IMPORTED_MODULE_8__/* .toStrokeStyle */ .T)(
          { ...this._originalStroke },
          _graphics_shared_GraphicsContext_mjs__WEBPACK_IMPORTED_MODULE_7__/* .GraphicsContext */ .T.defaultStrokeStyle
        );
      });
    }
    this._stroke = (0,_graphics_shared_utils_convertFillInputToFillStyle_mjs__WEBPACK_IMPORTED_MODULE_8__/* .toStrokeStyle */ .T)(value, _graphics_shared_GraphicsContext_mjs__WEBPACK_IMPORTED_MODULE_7__/* .GraphicsContext */ .T.defaultStrokeStyle);
    this.update();
  }
  update() {
    this._tick++;
    this.emit("update", this);
  }
  /** Resets all properties to the default values */
  reset() {
    const defaultStyle = _TextStyle.defaultTextStyle;
    for (const key in defaultStyle) {
      this[key] = defaultStyle[key];
    }
  }
  /**
   * Returns a unique key for this instance.
   * This key is used for caching.
   * @returns {string} Unique key for the instance
   */
  get styleKey() {
    return `${this.uid}-${this._tick}`;
  }
  /**
   * Creates a new TextStyle object with the same values as this one.
   * @returns New cloned TextStyle object
   */
  clone() {
    return new _TextStyle({
      align: this.align,
      breakWords: this.breakWords,
      dropShadow: this._dropShadow ? { ...this._dropShadow } : null,
      fill: this._fill,
      fontFamily: this.fontFamily,
      fontSize: this.fontSize,
      fontStyle: this.fontStyle,
      fontVariant: this.fontVariant,
      fontWeight: this.fontWeight,
      leading: this.leading,
      letterSpacing: this.letterSpacing,
      lineHeight: this.lineHeight,
      padding: this.padding,
      stroke: this._stroke,
      textBaseline: this.textBaseline,
      whiteSpace: this.whiteSpace,
      wordWrap: this.wordWrap,
      wordWrapWidth: this.wordWrapWidth,
      filters: this._filters ? [...this._filters] : void 0
    });
  }
  /**
   * Returns the final padding for the text style, taking into account any filters applied.
   * Used internally for correct measurements
   * @internal
   * @returns {number} The final padding for the text style.
   */
  _getFinalPadding() {
    let filterPadding = 0;
    if (this._filters) {
      for (let i = 0; i < this._filters.length; i++) {
        filterPadding += this._filters[i].padding;
      }
    }
    return Math.max(this._padding, filterPadding);
  }
  /**
   * Destroys this text style.
   * @param options - Options parameter. A boolean will act as if all options
   *  have been set to that value
   * @example
   * // Destroy the text style and its textures
   * textStyle.destroy({ texture: true, textureSource: true });
   * textStyle.destroy(true);
   */
  destroy(options = false) {
    this.removeAllListeners();
    const destroyTexture = typeof options === "boolean" ? options : options?.texture;
    if (destroyTexture) {
      const destroyTextureSource = typeof options === "boolean" ? options : options?.textureSource;
      if (this._fill?.texture) {
        this._fill.texture.destroy(destroyTextureSource);
      }
      if (this._originalFill?.texture) {
        this._originalFill.texture.destroy(destroyTextureSource);
      }
      if (this._stroke?.texture) {
        this._stroke.texture.destroy(destroyTextureSource);
      }
      if (this._originalStroke?.texture) {
        this._originalStroke.texture.destroy(destroyTextureSource);
      }
    }
    this._fill = null;
    this._stroke = null;
    this.dropShadow = null;
    this._originalStroke = null;
    this._originalFill = null;
  }
  _createProxy(value, cb) {
    return new Proxy(value, {
      set: (target, property, newValue) => {
        if (target[property] === newValue)
          return true;
        target[property] = newValue;
        cb?.(property, newValue);
        this.update();
        return true;
      }
    });
  }
  _isFillStyle(value) {
    return (value ?? null) !== null && !(_color_Color_mjs__WEBPACK_IMPORTED_MODULE_1__/* .Color */ .Q.isColorLike(value) || value instanceof _graphics_shared_fill_FillGradient_mjs__WEBPACK_IMPORTED_MODULE_5__/* .FillGradient */ ._ || value instanceof _graphics_shared_fill_FillPattern_mjs__WEBPACK_IMPORTED_MODULE_6__/* .FillPattern */ .m);
  }
};
/**
 * Default drop shadow settings used when enabling drop shadows on text.
 * These values are used as the base configuration when drop shadows are enabled without specific settings.
 * @example
 * ```ts
 * // Customize default settings globally
 * TextStyle.defaultDropShadow.alpha = 0.5;    // 50% opacity for all shadows
 * TextStyle.defaultDropShadow.blur = 2;       // 2px blur for all shadows
 * TextStyle.defaultDropShadow.color = 'blue'; // Blue shadows by default
 * ```
 */
_TextStyle.defaultDropShadow = {
  alpha: 1,
  angle: Math.PI / 6,
  blur: 0,
  color: "black",
  distance: 5
};
/**
 * Default text style settings used when creating new text objects.
 * These values serve as the base configuration and can be customized globally.
 * @example
 * ```ts
 * // Customize default text style globally
 * TextStyle.defaultTextStyle.fontSize = 16;
 * TextStyle.defaultTextStyle.fill = 0x333333;
 * TextStyle.defaultTextStyle.fontFamily = ['Arial', 'Helvetica', 'sans-serif'];
 * ```
 */
_TextStyle.defaultTextStyle = {
  align: "left",
  breakWords: false,
  dropShadow: null,
  fill: "black",
  fontFamily: "Arial",
  fontSize: 26,
  fontStyle: "normal",
  fontVariant: "normal",
  fontWeight: "normal",
  leading: 0,
  letterSpacing: 0,
  lineHeight: 0,
  padding: 0,
  stroke: null,
  textBaseline: "alphabetic",
  trim: false,
  whiteSpace: "pre",
  wordWrap: false,
  wordWrapWidth: 100
};
let TextStyle = _TextStyle;
function convertV7Tov8Style(style) {
  const oldStyle = style;
  if (typeof oldStyle.dropShadow === "boolean" && oldStyle.dropShadow) {
    const defaults = TextStyle.defaultDropShadow;
    style.dropShadow = {
      alpha: oldStyle.dropShadowAlpha ?? defaults.alpha,
      angle: oldStyle.dropShadowAngle ?? defaults.angle,
      blur: oldStyle.dropShadowBlur ?? defaults.blur,
      color: oldStyle.dropShadowColor ?? defaults.color,
      distance: oldStyle.dropShadowDistance ?? defaults.distance
    };
  }
  if (oldStyle.strokeThickness !== void 0) {
    (0,_utils_logging_deprecation_mjs__WEBPACK_IMPORTED_MODULE_3__/* .deprecation */ .t6)(_utils_logging_deprecation_mjs__WEBPACK_IMPORTED_MODULE_3__/* .v8_0_0 */ .lj, "strokeThickness is now a part of stroke");
    const color = oldStyle.stroke;
    let obj = {};
    if (_color_Color_mjs__WEBPACK_IMPORTED_MODULE_1__/* .Color */ .Q.isColorLike(color)) {
      obj.color = color;
    } else if (color instanceof _graphics_shared_fill_FillGradient_mjs__WEBPACK_IMPORTED_MODULE_5__/* .FillGradient */ ._ || color instanceof _graphics_shared_fill_FillPattern_mjs__WEBPACK_IMPORTED_MODULE_6__/* .FillPattern */ .m) {
      obj.fill = color;
    } else if (Object.hasOwnProperty.call(color, "color") || Object.hasOwnProperty.call(color, "fill")) {
      obj = color;
    } else {
      throw new Error("Invalid stroke value.");
    }
    style.stroke = {
      ...obj,
      width: oldStyle.strokeThickness
    };
  }
  if (Array.isArray(oldStyle.fillGradientStops)) {
    (0,_utils_logging_deprecation_mjs__WEBPACK_IMPORTED_MODULE_3__/* .deprecation */ .t6)(_utils_logging_deprecation_mjs__WEBPACK_IMPORTED_MODULE_3__/* .v8_0_0 */ .lj, "gradient fill is now a fill pattern: `new FillGradient(...)`");
    if (!Array.isArray(oldStyle.fill) || oldStyle.fill.length === 0) {
      throw new Error("Invalid fill value. Expected an array of colors for gradient fill.");
    }
    if (oldStyle.fill.length !== oldStyle.fillGradientStops.length) {
      (0,_utils_logging_warn_mjs__WEBPACK_IMPORTED_MODULE_4__/* .warn */ .R)("The number of fill colors must match the number of fill gradient stops.");
    }
    const gradientFill = new _graphics_shared_fill_FillGradient_mjs__WEBPACK_IMPORTED_MODULE_5__/* .FillGradient */ ._({
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      textureSpace: "local"
    });
    const fillGradientStops = oldStyle.fillGradientStops.slice();
    const fills = oldStyle.fill.map((color) => _color_Color_mjs__WEBPACK_IMPORTED_MODULE_1__/* .Color */ .Q.shared.setValue(color).toNumber());
    fillGradientStops.forEach((stop, index) => {
      gradientFill.addColorStop(stop, fills[index]);
    });
    style.fill = {
      fill: gradientFill
    };
  }
}


//# sourceMappingURL=TextStyle.mjs.map


/***/ },

/***/ 4016
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   P: () => (/* binding */ CanvasTextMetrics)
/* harmony export */ });
/* harmony import */ var tiny_lru__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(5957);
/* harmony import */ var _environment_adapter_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(6559);
/* harmony import */ var _utils_fontStringFromTextStyle_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(1242);




"use strict";
const contextSettings = {
  // TextMetrics requires getImageData readback for measuring fonts.
  willReadFrequently: true
};
const _CanvasTextMetrics = class _CanvasTextMetrics {
  /**
   * Checking that we can use modern canvas 2D API.
   *
   * Note: This is an unstable API, Chrome < 94 use `textLetterSpacing`, later versions use `letterSpacing`.
   * @see TextMetrics.experimentalLetterSpacing
   * @see https://developer.mozilla.org/en-US/docs/Web/API/ICanvasRenderingContext2D/letterSpacing
   * @see https://developer.chrome.com/origintrials/#/view_trial/3585991203293757441
   */
  static get experimentalLetterSpacingSupported() {
    let result = _CanvasTextMetrics._experimentalLetterSpacingSupported;
    if (result === void 0) {
      const proto = _environment_adapter_mjs__WEBPACK_IMPORTED_MODULE_1__/* .DOMAdapter */ .e.get().getCanvasRenderingContext2D().prototype;
      result = _CanvasTextMetrics._experimentalLetterSpacingSupported = "letterSpacing" in proto || "textLetterSpacing" in proto;
    }
    return result;
  }
  /**
   * @param text - the text that was measured
   * @param style - the style that was measured
   * @param width - the measured width of the text
   * @param height - the measured height of the text
   * @param lines - an array of the lines of text broken by new lines and wrapping if specified in style
   * @param lineWidths - an array of the line widths for each line matched to `lines`
   * @param lineHeight - the measured line height for this style
   * @param maxLineWidth - the maximum line width for all measured lines
   * @param {FontMetrics} fontProperties - the font properties object from TextMetrics.measureFont
   */
  constructor(text, style, width, height, lines, lineWidths, lineHeight, maxLineWidth, fontProperties) {
    this.text = text;
    this.style = style;
    this.width = width;
    this.height = height;
    this.lines = lines;
    this.lineWidths = lineWidths;
    this.lineHeight = lineHeight;
    this.maxLineWidth = maxLineWidth;
    this.fontProperties = fontProperties;
  }
  /**
   * Measures the supplied string of text and returns a Rectangle.
   * @param text - The text to measure.
   * @param style - The text style to use for measuring
   * @param canvas - optional specification of the canvas to use for measuring.
   * @param wordWrap
   * @returns Measured width and height of the text.
   */
  static measureText(text = " ", style, canvas = _CanvasTextMetrics._canvas, wordWrap = style.wordWrap) {
    const textKey = `${text}-${style.styleKey}-wordWrap-${wordWrap}`;
    if (_CanvasTextMetrics._measurementCache.has(textKey)) {
      return _CanvasTextMetrics._measurementCache.get(textKey);
    }
    const font = (0,_utils_fontStringFromTextStyle_mjs__WEBPACK_IMPORTED_MODULE_2__/* .fontStringFromTextStyle */ .Z)(style);
    const fontProperties = _CanvasTextMetrics.measureFont(font);
    if (fontProperties.fontSize === 0) {
      fontProperties.fontSize = style.fontSize;
      fontProperties.ascent = style.fontSize;
    }
    const context = _CanvasTextMetrics.__context;
    context.font = font;
    const outputText = wordWrap ? _CanvasTextMetrics._wordWrap(text, style, canvas) : text;
    const lines = outputText.split(/(?:\r\n|\r|\n)/);
    const lineWidths = new Array(lines.length);
    let maxLineWidth = 0;
    for (let i = 0; i < lines.length; i++) {
      const lineWidth = _CanvasTextMetrics._measureText(lines[i], style.letterSpacing, context);
      lineWidths[i] = lineWidth;
      maxLineWidth = Math.max(maxLineWidth, lineWidth);
    }
    const strokeWidth = style._stroke?.width || 0;
    let width = maxLineWidth + strokeWidth;
    if (style.dropShadow) {
      width += style.dropShadow.distance;
    }
    const lineHeight = style.lineHeight || fontProperties.fontSize;
    let height = Math.max(lineHeight, fontProperties.fontSize + strokeWidth) + (lines.length - 1) * (lineHeight + style.leading);
    if (style.dropShadow) {
      height += style.dropShadow.distance;
    }
    const measurements = new _CanvasTextMetrics(
      text,
      style,
      width,
      height,
      lines,
      lineWidths,
      lineHeight + style.leading,
      maxLineWidth,
      fontProperties
    );
    _CanvasTextMetrics._measurementCache.set(textKey, measurements);
    return measurements;
  }
  static _measureText(text, letterSpacing, context) {
    let useExperimentalLetterSpacing = false;
    if (_CanvasTextMetrics.experimentalLetterSpacingSupported) {
      if (_CanvasTextMetrics.experimentalLetterSpacing) {
        context.letterSpacing = `${letterSpacing}px`;
        context.textLetterSpacing = `${letterSpacing}px`;
        useExperimentalLetterSpacing = true;
      } else {
        context.letterSpacing = "0px";
        context.textLetterSpacing = "0px";
      }
    }
    const metrics = context.measureText(text);
    let metricWidth = metrics.width;
    const actualBoundingBoxLeft = -metrics.actualBoundingBoxLeft;
    const actualBoundingBoxRight = metrics.actualBoundingBoxRight;
    let boundsWidth = actualBoundingBoxRight - actualBoundingBoxLeft;
    if (metricWidth > 0) {
      if (useExperimentalLetterSpacing) {
        metricWidth -= letterSpacing;
        boundsWidth -= letterSpacing;
      } else {
        const val = (_CanvasTextMetrics.graphemeSegmenter(text).length - 1) * letterSpacing;
        metricWidth += val;
        boundsWidth += val;
      }
    }
    return Math.max(metricWidth, boundsWidth);
  }
  /**
   * Applies newlines to a string to have it optimally fit into the horizontal
   * bounds set by the Text object's wordWrapWidth property.
   * @param text - String to apply word wrapping to
   * @param style - the style to use when wrapping
   * @param canvas - optional specification of the canvas to use for measuring.
   * @returns New string with new lines applied where required
   */
  static _wordWrap(text, style, canvas = _CanvasTextMetrics._canvas) {
    const context = canvas.getContext("2d", contextSettings);
    let width = 0;
    let line = "";
    let lines = "";
    const cache = /* @__PURE__ */ Object.create(null);
    const { letterSpacing, whiteSpace } = style;
    const collapseSpaces = _CanvasTextMetrics._collapseSpaces(whiteSpace);
    const collapseNewlines = _CanvasTextMetrics._collapseNewlines(whiteSpace);
    let canPrependSpaces = !collapseSpaces;
    const wordWrapWidth = style.wordWrapWidth + letterSpacing;
    const tokens = _CanvasTextMetrics._tokenize(text);
    for (let i = 0; i < tokens.length; i++) {
      let token = tokens[i];
      if (_CanvasTextMetrics._isNewline(token)) {
        if (!collapseNewlines) {
          lines += _CanvasTextMetrics._addLine(line);
          canPrependSpaces = !collapseSpaces;
          line = "";
          width = 0;
          continue;
        }
        token = " ";
      }
      if (collapseSpaces) {
        const currIsBreakingSpace = _CanvasTextMetrics.isBreakingSpace(token);
        const lastIsBreakingSpace = _CanvasTextMetrics.isBreakingSpace(line[line.length - 1]);
        if (currIsBreakingSpace && lastIsBreakingSpace) {
          continue;
        }
      }
      const tokenWidth = _CanvasTextMetrics._getFromCache(token, letterSpacing, cache, context);
      if (tokenWidth > wordWrapWidth) {
        if (line !== "") {
          lines += _CanvasTextMetrics._addLine(line);
          line = "";
          width = 0;
        }
        if (_CanvasTextMetrics.canBreakWords(token, style.breakWords)) {
          const characters = _CanvasTextMetrics.wordWrapSplit(token);
          for (let j = 0; j < characters.length; j++) {
            let char = characters[j];
            let lastChar = char;
            let k = 1;
            while (characters[j + k]) {
              const nextChar = characters[j + k];
              if (!_CanvasTextMetrics.canBreakChars(lastChar, nextChar, token, j, style.breakWords)) {
                char += nextChar;
              } else {
                break;
              }
              lastChar = nextChar;
              k++;
            }
            j += k - 1;
            const characterWidth = _CanvasTextMetrics._getFromCache(char, letterSpacing, cache, context);
            if (characterWidth + width > wordWrapWidth) {
              lines += _CanvasTextMetrics._addLine(line);
              canPrependSpaces = false;
              line = "";
              width = 0;
            }
            line += char;
            width += characterWidth;
          }
        } else {
          if (line.length > 0) {
            lines += _CanvasTextMetrics._addLine(line);
            line = "";
            width = 0;
          }
          const isLastToken = i === tokens.length - 1;
          lines += _CanvasTextMetrics._addLine(token, !isLastToken);
          canPrependSpaces = false;
          line = "";
          width = 0;
        }
      } else {
        if (tokenWidth + width > wordWrapWidth) {
          canPrependSpaces = false;
          lines += _CanvasTextMetrics._addLine(line);
          line = "";
          width = 0;
        }
        if (line.length > 0 || !_CanvasTextMetrics.isBreakingSpace(token) || canPrependSpaces) {
          line += token;
          width += tokenWidth;
        }
      }
    }
    lines += _CanvasTextMetrics._addLine(line, false);
    return lines;
  }
  /**
   * Convenience function for logging each line added during the wordWrap method.
   * @param line    - The line of text to add
   * @param newLine - Add new line character to end
   * @returns A formatted line
   */
  static _addLine(line, newLine = true) {
    line = _CanvasTextMetrics._trimRight(line);
    line = newLine ? `${line}
` : line;
    return line;
  }
  /**
   * Gets & sets the widths of calculated characters in a cache object
   * @param key            - The key
   * @param letterSpacing  - The letter spacing
   * @param cache          - The cache
   * @param context        - The canvas context
   * @returns The from cache.
   */
  static _getFromCache(key, letterSpacing, cache, context) {
    let width = cache[key];
    if (typeof width !== "number") {
      width = _CanvasTextMetrics._measureText(key, letterSpacing, context) + letterSpacing;
      cache[key] = width;
    }
    return width;
  }
  /**
   * Determines whether we should collapse breaking spaces.
   * @param whiteSpace - The TextStyle property whiteSpace
   * @returns Should collapse
   */
  static _collapseSpaces(whiteSpace) {
    return whiteSpace === "normal" || whiteSpace === "pre-line";
  }
  /**
   * Determines whether we should collapse newLine chars.
   * @param whiteSpace - The white space
   * @returns should collapse
   */
  static _collapseNewlines(whiteSpace) {
    return whiteSpace === "normal";
  }
  /**
   * Trims breaking whitespaces from string.
   * @param text - The text
   * @returns Trimmed string
   */
  static _trimRight(text) {
    if (typeof text !== "string") {
      return "";
    }
    for (let i = text.length - 1; i >= 0; i--) {
      const char = text[i];
      if (!_CanvasTextMetrics.isBreakingSpace(char)) {
        break;
      }
      text = text.slice(0, -1);
    }
    return text;
  }
  /**
   * Determines if char is a newline.
   * @param char - The character
   * @returns True if newline, False otherwise.
   */
  static _isNewline(char) {
    if (typeof char !== "string") {
      return false;
    }
    return _CanvasTextMetrics._newlines.includes(char.charCodeAt(0));
  }
  /**
   * Determines if char is a breaking whitespace.
   *
   * It allows one to determine whether char should be a breaking whitespace
   * For example certain characters in CJK langs or numbers.
   * It must return a boolean.
   * @param char - The character
   * @param [_nextChar] - The next character
   * @returns True if whitespace, False otherwise.
   */
  static isBreakingSpace(char, _nextChar) {
    if (typeof char !== "string") {
      return false;
    }
    return _CanvasTextMetrics._breakingSpaces.includes(char.charCodeAt(0));
  }
  /**
   * Splits a string into words, breaking-spaces and newLine characters
   * @param text - The text
   * @returns A tokenized array
   */
  static _tokenize(text) {
    const tokens = [];
    let token = "";
    if (typeof text !== "string") {
      return tokens;
    }
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];
      if (_CanvasTextMetrics.isBreakingSpace(char, nextChar) || _CanvasTextMetrics._isNewline(char)) {
        if (token !== "") {
          tokens.push(token);
          token = "";
        }
        if (char === "\r" && nextChar === "\n") {
          tokens.push("\r\n");
          i++;
        } else {
          tokens.push(char);
        }
        continue;
      }
      token += char;
    }
    if (token !== "") {
      tokens.push(token);
    }
    return tokens;
  }
  /**
   * Overridable helper method used internally by TextMetrics, exposed to allow customizing the class's behavior.
   *
   * It allows one to customise which words should break
   * Examples are if the token is CJK or numbers.
   * It must return a boolean.
   * @param _token - The token
   * @param breakWords - The style attr break words
   * @returns Whether to break word or not
   */
  static canBreakWords(_token, breakWords) {
    return breakWords;
  }
  /**
   * Overridable helper method used internally by TextMetrics, exposed to allow customizing the class's behavior.
   *
   * It allows one to determine whether a pair of characters
   * should be broken by newlines
   * For example certain characters in CJK langs or numbers.
   * It must return a boolean.
   * @param _char - The character
   * @param _nextChar - The next character
   * @param _token - The token/word the characters are from
   * @param _index - The index in the token of the char
   * @param _breakWords - The style attr break words
   * @returns whether to break word or not
   */
  static canBreakChars(_char, _nextChar, _token, _index, _breakWords) {
    return true;
  }
  /**
   * Overridable helper method used internally by TextMetrics, exposed to allow customizing the class's behavior.
   *
   * It is called when a token (usually a word) has to be split into separate pieces
   * in order to determine the point to break a word.
   * It must return an array of characters.
   * @param token - The token to split
   * @returns The characters of the token
   * @see CanvasTextMetrics.graphemeSegmenter
   */
  static wordWrapSplit(token) {
    return _CanvasTextMetrics.graphemeSegmenter(token);
  }
  /**
   * Calculates the ascent, descent and fontSize of a given font-style
   * @param font - String representing the style of the font
   * @returns Font properties object
   */
  static measureFont(font) {
    if (_CanvasTextMetrics._fonts[font]) {
      return _CanvasTextMetrics._fonts[font];
    }
    const context = _CanvasTextMetrics._context;
    context.font = font;
    const metrics = context.measureText(_CanvasTextMetrics.METRICS_STRING + _CanvasTextMetrics.BASELINE_SYMBOL);
    const properties = {
      ascent: metrics.actualBoundingBoxAscent,
      descent: metrics.actualBoundingBoxDescent,
      fontSize: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent
    };
    _CanvasTextMetrics._fonts[font] = properties;
    return properties;
  }
  /**
   * Clear font metrics in metrics cache.
   * @param {string} [font] - font name. If font name not set then clear cache for all fonts.
   */
  static clearMetrics(font = "") {
    if (font) {
      delete _CanvasTextMetrics._fonts[font];
    } else {
      _CanvasTextMetrics._fonts = {};
    }
  }
  /**
   * Cached canvas element for measuring text
   * TODO: this should be private, but isn't because of backward compat, will fix later.
   * @ignore
   */
  static get _canvas() {
    if (!_CanvasTextMetrics.__canvas) {
      let canvas;
      try {
        const c = new OffscreenCanvas(0, 0);
        const context = c.getContext("2d", contextSettings);
        if (context?.measureText) {
          _CanvasTextMetrics.__canvas = c;
          return c;
        }
        canvas = _environment_adapter_mjs__WEBPACK_IMPORTED_MODULE_1__/* .DOMAdapter */ .e.get().createCanvas();
      } catch (_cx) {
        canvas = _environment_adapter_mjs__WEBPACK_IMPORTED_MODULE_1__/* .DOMAdapter */ .e.get().createCanvas();
      }
      canvas.width = canvas.height = 10;
      _CanvasTextMetrics.__canvas = canvas;
    }
    return _CanvasTextMetrics.__canvas;
  }
  /**
   * TODO: this should be private, but isn't because of backward compat, will fix later.
   * @ignore
   */
  static get _context() {
    if (!_CanvasTextMetrics.__context) {
      _CanvasTextMetrics.__context = _CanvasTextMetrics._canvas.getContext("2d", contextSettings);
    }
    return _CanvasTextMetrics.__context;
  }
};
/**
 * String used for calculate font metrics.
 * These characters are all tall to help calculate the height required for text.
 */
_CanvasTextMetrics.METRICS_STRING = "|\xC9q\xC5";
/** Baseline symbol for calculate font metrics. */
_CanvasTextMetrics.BASELINE_SYMBOL = "M";
/** Baseline multiplier for calculate font metrics. */
_CanvasTextMetrics.BASELINE_MULTIPLIER = 1.4;
/** Height multiplier for setting height of canvas to calculate font metrics. */
_CanvasTextMetrics.HEIGHT_MULTIPLIER = 2;
/**
 * A Unicode "character", or "grapheme cluster", can be composed of multiple Unicode code points,
 * such as letters with diacritical marks (e.g. `'\u0065\u0301'`, letter e with acute)
 * or emojis with modifiers (e.g. `'\uD83E\uDDD1\u200D\uD83D\uDCBB'`, technologist).
 * The new `Intl.Segmenter` API in ES2022 can split the string into grapheme clusters correctly. If it is not available,
 * PixiJS will fallback to use the iterator of String, which can only spilt the string into code points.
 * If you want to get full functionality in environments that don't support `Intl.Segmenter` (such as Firefox),
 * you can use other libraries such as [grapheme-splitter]{@link https://www.npmjs.com/package/grapheme-splitter}
 * or [graphemer]{@link https://www.npmjs.com/package/graphemer} to create a polyfill. Since these libraries can be
 * relatively large in size to handle various Unicode grapheme clusters properly, PixiJS won't use them directly.
 */
_CanvasTextMetrics.graphemeSegmenter = (() => {
  if (typeof Intl?.Segmenter === "function") {
    const segmenter = new Intl.Segmenter();
    return (s) => {
      const segments = segmenter.segment(s);
      const result = [];
      let i = 0;
      for (const segment of segments) {
        result[i++] = segment.segment;
      }
      return result;
    };
  }
  return (s) => [...s];
})();
/**
 * New rendering behavior for letter-spacing which uses Chrome's new native API. This will
 * lead to more accurate letter-spacing results because it does not try to manually draw
 * each character. However, this Chrome API is experimental and may not serve all cases yet.
 * @see TextMetrics.experimentalLetterSpacingSupported
 */
_CanvasTextMetrics.experimentalLetterSpacing = false;
/** Cache of {@link TextMetrics.FontMetrics} objects. */
_CanvasTextMetrics._fonts = {};
/** Cache of new line chars. */
_CanvasTextMetrics._newlines = [
  10,
  // line feed
  13
  // carriage return
];
/** Cache of breaking spaces. */
_CanvasTextMetrics._breakingSpaces = [
  9,
  // character tabulation
  32,
  // space
  8192,
  // en quad
  8193,
  // em quad
  8194,
  // en space
  8195,
  // em space
  8196,
  // three-per-em space
  8197,
  // four-per-em space
  8198,
  // six-per-em space
  8200,
  // punctuation space
  8201,
  // thin space
  8202,
  // hair space
  8287,
  // medium mathematical space
  12288
  // ideographic space
];
/** Cache for measured text metrics */
_CanvasTextMetrics._measurementCache = (0,tiny_lru__WEBPACK_IMPORTED_MODULE_0__/* .lru */ .g)(1e3);
let CanvasTextMetrics = _CanvasTextMetrics;


//# sourceMappingURL=CanvasTextMetrics.mjs.map


/***/ },

/***/ 1242
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Z: () => (/* binding */ fontStringFromTextStyle)
/* harmony export */ });

const genericFontFamilies = [
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui"
];
function fontStringFromTextStyle(style) {
  const fontSizeString = typeof style.fontSize === "number" ? `${style.fontSize}px` : style.fontSize;
  let fontFamilies = style.fontFamily;
  if (!Array.isArray(style.fontFamily)) {
    fontFamilies = style.fontFamily.split(",");
  }
  for (let i = fontFamilies.length - 1; i >= 0; i--) {
    let fontFamily = fontFamilies[i].trim();
    if (!/([\"\'])[^\'\"]+\1/.test(fontFamily) && !genericFontFamilies.includes(fontFamily)) {
      fontFamily = `"${fontFamily}"`;
    }
    fontFamilies[i] = fontFamily;
  }
  return `${style.fontStyle} ${style.fontVariant} ${style.fontWeight} ${fontSizeString} ${fontFamilies.join(",")}`;
}


//# sourceMappingURL=fontStringFromTextStyle.mjs.map


/***/ },

/***/ 3548
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   r: () => (/* binding */ getCanvasFillStyle)
/* harmony export */ });
/* harmony import */ var _color_Color_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3556);
/* harmony import */ var _maths_matrix_Matrix_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(9313);
/* harmony import */ var _rendering_renderers_shared_texture_Texture_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(226);
/* harmony import */ var _utils_logging_warn_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(268);
/* harmony import */ var _graphics_shared_fill_FillGradient_mjs__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(7276);
/* harmony import */ var _graphics_shared_fill_FillPattern_mjs__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(2806);







"use strict";
const PRECISION = 1e5;
function getCanvasFillStyle(fillStyle, context, textMetrics, padding = 0) {
  if (fillStyle.texture === _rendering_renderers_shared_texture_Texture_mjs__WEBPACK_IMPORTED_MODULE_2__/* .Texture */ .g.WHITE && !fillStyle.fill) {
    return _color_Color_mjs__WEBPACK_IMPORTED_MODULE_0__/* .Color */ .Q.shared.setValue(fillStyle.color).setAlpha(fillStyle.alpha ?? 1).toHexa();
  } else if (!fillStyle.fill) {
    const pattern = context.createPattern(fillStyle.texture.source.resource, "repeat");
    const tempMatrix = fillStyle.matrix.copyTo(_maths_matrix_Matrix_mjs__WEBPACK_IMPORTED_MODULE_1__/* .Matrix */ .u.shared);
    tempMatrix.scale(fillStyle.texture.frame.width, fillStyle.texture.frame.height);
    pattern.setTransform(tempMatrix);
    return pattern;
  } else if (fillStyle.fill instanceof _graphics_shared_fill_FillPattern_mjs__WEBPACK_IMPORTED_MODULE_5__/* .FillPattern */ .m) {
    const fillPattern = fillStyle.fill;
    const pattern = context.createPattern(fillPattern.texture.source.resource, "repeat");
    const tempMatrix = fillPattern.transform.copyTo(_maths_matrix_Matrix_mjs__WEBPACK_IMPORTED_MODULE_1__/* .Matrix */ .u.shared);
    tempMatrix.scale(
      fillPattern.texture.frame.width,
      fillPattern.texture.frame.height
    );
    pattern.setTransform(tempMatrix);
    return pattern;
  } else if (fillStyle.fill instanceof _graphics_shared_fill_FillGradient_mjs__WEBPACK_IMPORTED_MODULE_4__/* .FillGradient */ ._) {
    const fillGradient = fillStyle.fill;
    const isLinear = fillGradient.type === "linear";
    const isLocal = fillGradient.textureSpace === "local";
    let width = 1;
    let height = 1;
    if (isLocal && textMetrics) {
      width = textMetrics.width + padding;
      height = textMetrics.height + padding;
    }
    let gradient;
    let isNearlyVertical = false;
    if (isLinear) {
      const { start, end } = fillGradient;
      gradient = context.createLinearGradient(
        start.x * width,
        start.y * height,
        end.x * width,
        end.y * height
      );
      isNearlyVertical = Math.abs(end.x - start.x) < Math.abs((end.y - start.y) * 0.1);
    } else {
      const { center, innerRadius, outerCenter, outerRadius } = fillGradient;
      gradient = context.createRadialGradient(
        center.x * width,
        center.y * height,
        innerRadius * width,
        outerCenter.x * width,
        outerCenter.y * height,
        outerRadius * width
      );
    }
    if (isNearlyVertical && isLocal && textMetrics) {
      const ratio = textMetrics.lineHeight / height;
      for (let i = 0; i < textMetrics.lines.length; i++) {
        const start = (i * textMetrics.lineHeight + padding / 2) / height;
        fillGradient.colorStops.forEach((stop) => {
          const globalStop = start + stop.offset * ratio;
          gradient.addColorStop(
            // fix to 5 decimal places to avoid floating point precision issues
            Math.floor(globalStop * PRECISION) / PRECISION,
            _color_Color_mjs__WEBPACK_IMPORTED_MODULE_0__/* .Color */ .Q.shared.setValue(stop.color).toHex()
          );
        });
      }
    } else {
      fillGradient.colorStops.forEach((stop) => {
        gradient.addColorStop(stop.offset, _color_Color_mjs__WEBPACK_IMPORTED_MODULE_0__/* .Color */ .Q.shared.setValue(stop.color).toHex());
      });
    }
    return gradient;
  }
  (0,_utils_logging_warn_mjs__WEBPACK_IMPORTED_MODULE_3__/* .warn */ .R)("FillStyle not recognised", fillStyle);
  return "red";
}


//# sourceMappingURL=getCanvasFillStyle.mjs.map


/***/ },

/***/ 1258
(__unused_webpack___webpack_module__, __unused_webpack___webpack_exports__, __webpack_require__) {

"use strict";

// EXTERNAL MODULE: ./node_modules/pixi.js/lib/extensions/Extensions.mjs
var Extensions = __webpack_require__(8507);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/text/utils/updateTextBounds.mjs
var updateTextBounds = __webpack_require__(2289);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/sprite/BatchableSprite.mjs
var BatchableSprite = __webpack_require__(8422);
;// ./node_modules/pixi.js/lib/scene/text/canvas/BatchableText.mjs


"use strict";
class BatchableText extends BatchableSprite/* BatchableSprite */.K {
  constructor(renderer) {
    super();
    this._renderer = renderer;
    renderer.runners.resolutionChange.add(this);
  }
  resolutionChange() {
    const text = this.renderable;
    if (text._autoResolution) {
      text.onViewUpdate();
    }
  }
  destroy() {
    const { canvasText } = this._renderer;
    const refCount = canvasText.getReferenceCount(this.currentKey);
    if (refCount > 0) {
      canvasText.decreaseReferenceCount(this.currentKey);
    } else if (this.texture) {
      canvasText.returnTexture(this.texture);
    }
    this._renderer.runners.resolutionChange.remove(this);
    this._renderer = null;
  }
}


//# sourceMappingURL=BatchableText.mjs.map

;// ./node_modules/pixi.js/lib/scene/text/canvas/CanvasTextPipe.mjs




"use strict";
class CanvasTextPipe {
  constructor(renderer) {
    this._renderer = renderer;
  }
  validateRenderable(text) {
    const gpuText = this._getGpuText(text);
    const newKey = text.styleKey;
    if (gpuText.currentKey !== newKey)
      return true;
    return text._didTextUpdate;
  }
  addRenderable(text, instructionSet) {
    const batchableText = this._getGpuText(text);
    if (text._didTextUpdate) {
      const resolution = text._autoResolution ? this._renderer.resolution : text.resolution;
      if (batchableText.currentKey !== text.styleKey || text.resolution !== resolution) {
        this._updateGpuText(text);
      }
      text._didTextUpdate = false;
      (0,updateTextBounds/* updateTextBounds */.s)(batchableText, text);
    }
    this._renderer.renderPipes.batch.addToBatch(batchableText, instructionSet);
  }
  updateRenderable(text) {
    const batchableText = this._getGpuText(text);
    batchableText._batcher.updateElement(batchableText);
  }
  _updateGpuText(text) {
    const batchableText = this._getGpuText(text);
    if (batchableText.texture) {
      this._renderer.canvasText.decreaseReferenceCount(batchableText.currentKey);
    }
    text._resolution = text._autoResolution ? this._renderer.resolution : text.resolution;
    batchableText.texture = this._renderer.canvasText.getManagedTexture(text);
    batchableText.currentKey = text.styleKey;
  }
  _getGpuText(text) {
    return text._gpuData[this._renderer.uid] || this.initGpuText(text);
  }
  initGpuText(text) {
    const batchableText = new BatchableText(this._renderer);
    batchableText.currentKey = "--";
    batchableText.renderable = text;
    batchableText.transform = text.groupTransform;
    batchableText.bounds = { minX: 0, maxX: 1, minY: 0, maxY: 0 };
    batchableText.roundPixels = this._renderer._roundPixels | text._roundPixels;
    text._gpuData[this._renderer.uid] = batchableText;
    return batchableText;
  }
  destroy() {
    this._renderer = null;
  }
}
/** @ignore */
CanvasTextPipe.extension = {
  type: [
    Extensions/* ExtensionType */.Ag.WebGLPipes,
    Extensions/* ExtensionType */.Ag.WebGPUPipes,
    Extensions/* ExtensionType */.Ag.CanvasPipes
  ],
  name: "text"
};


//# sourceMappingURL=CanvasTextPipe.mjs.map

// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/texture/TexturePool.mjs
var TexturePool = __webpack_require__(2437);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/texture/TextureStyle.mjs
var TextureStyle = __webpack_require__(218);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/utils/logging/deprecation.mjs
var deprecation = __webpack_require__(4670);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/text/TextStyle.mjs
var TextStyle = __webpack_require__(8291);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/text/utils/getPo2TextureFromSource.mjs
var getPo2TextureFromSource = __webpack_require__(2558);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/color/Color.mjs + 2 modules
var Color = __webpack_require__(3556);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/maths/shapes/Rectangle.mjs
var Rectangle = __webpack_require__(9252);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/rendering/renderers/shared/texture/CanvasPool.mjs
var CanvasPool = __webpack_require__(7608);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/environment/adapter.mjs + 1 modules
var adapter = __webpack_require__(6559);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/maths/misc/pow2.mjs
var pow2 = __webpack_require__(9939);
;// ./node_modules/pixi.js/lib/utils/canvas/getCanvasBoundingBox.mjs




"use strict";
let _internalCanvas = null;
let _internalContext = null;
function ensureInternalCanvas(width, height) {
  if (!_internalCanvas) {
    _internalCanvas = adapter/* DOMAdapter */.e.get().createCanvas(256, 128);
    _internalContext = _internalCanvas.getContext("2d", { willReadFrequently: true });
    _internalContext.globalCompositeOperation = "copy";
    _internalContext.globalAlpha = 1;
  }
  if (_internalCanvas.width < width || _internalCanvas.height < height) {
    _internalCanvas.width = (0,pow2/* nextPow2 */.U5)(width);
    _internalCanvas.height = (0,pow2/* nextPow2 */.U5)(height);
  }
}
function checkRow(data, width, y) {
  for (let x = 0, index = 4 * y * width; x < width; ++x, index += 4) {
    if (data[index + 3] !== 0)
      return false;
  }
  return true;
}
function checkColumn(data, width, x, top, bottom) {
  const stride = 4 * width;
  for (let y = top, index = top * stride + 4 * x; y <= bottom; ++y, index += stride) {
    if (data[index + 3] !== 0)
      return false;
  }
  return true;
}
function getCanvasBoundingBox(...args) {
  let options = args[0];
  if (!options.canvas) {
    options = { canvas: args[0], resolution: args[1] };
  }
  const { canvas } = options;
  const resolution = Math.min(options.resolution ?? 1, 1);
  const width = options.width ?? canvas.width;
  const height = options.height ?? canvas.height;
  let output = options.output;
  ensureInternalCanvas(width, height);
  if (!_internalContext) {
    throw new TypeError("Failed to get canvas 2D context");
  }
  _internalContext.drawImage(
    canvas,
    0,
    0,
    width,
    height,
    0,
    0,
    width * resolution,
    height * resolution
  );
  const imageData = _internalContext.getImageData(0, 0, width, height);
  const data = imageData.data;
  let left = 0;
  let top = 0;
  let right = width - 1;
  let bottom = height - 1;
  while (top < height && checkRow(data, width, top))
    ++top;
  if (top === height)
    return Rectangle/* Rectangle */.M.EMPTY;
  while (checkRow(data, width, bottom))
    --bottom;
  while (checkColumn(data, width, left, top, bottom))
    ++left;
  while (checkColumn(data, width, right, top, bottom))
    --right;
  ++right;
  ++bottom;
  _internalContext.globalCompositeOperation = "source-over";
  _internalContext.strokeRect(left, top, right - left, bottom - top);
  _internalContext.globalCompositeOperation = "copy";
  output ?? (output = new Rectangle/* Rectangle */.M());
  output.set(left / resolution, top / resolution, (right - left) / resolution, (bottom - top) / resolution);
  return output;
}


//# sourceMappingURL=getCanvasBoundingBox.mjs.map

// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/text/canvas/CanvasTextMetrics.mjs
var CanvasTextMetrics = __webpack_require__(4016);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/text/canvas/utils/fontStringFromTextStyle.mjs
var fontStringFromTextStyle = __webpack_require__(1242);
// EXTERNAL MODULE: ./node_modules/pixi.js/lib/scene/text/canvas/utils/getCanvasFillStyle.mjs
var getCanvasFillStyle = __webpack_require__(3548);
;// ./node_modules/pixi.js/lib/scene/text/canvas/CanvasTextGenerator.mjs








"use strict";
const tempRect = new Rectangle/* Rectangle */.M();
class CanvasTextGeneratorClass {
  /**
   * Creates a canvas with the specified text rendered to it.
   *
   * Generates a canvas of appropriate size, renders the text with the provided style,
   * and returns both the canvas/context and a Rectangle representing the text bounds.
   *
   * When trim is enabled in the style, the frame will represent the bounds of the
   * non-transparent pixels, which can be smaller than the full canvas.
   * @param options - The options for generating the text canvas
   * @param options.text - The text to render
   * @param options.style - The style to apply to the text
   * @param options.resolution - The resolution of the canvas (defaults to 1)
   * @param options.padding
   * @returns An object containing the canvas/context and the frame (bounds) of the text
   */
  getCanvasAndContext(options) {
    const { text, style, resolution = 1 } = options;
    const padding = style._getFinalPadding();
    const measured = CanvasTextMetrics/* CanvasTextMetrics */.P.measureText(text || " ", style);
    const width = Math.ceil(Math.ceil(Math.max(1, measured.width) + padding * 2) * resolution);
    const height = Math.ceil(Math.ceil(Math.max(1, measured.height) + padding * 2) * resolution);
    const canvasAndContext = CanvasPool/* CanvasPool */.N.getOptimalCanvasAndContext(width, height);
    this._renderTextToCanvas(text, style, padding, resolution, canvasAndContext);
    const frame = style.trim ? getCanvasBoundingBox({ canvas: canvasAndContext.canvas, width, height, resolution: 1, output: tempRect }) : tempRect.set(0, 0, width, height);
    return {
      canvasAndContext,
      frame
    };
  }
  /**
   * Returns a canvas and context to the pool.
   *
   * This should be called when you're done with the canvas to allow reuse
   * and prevent memory leaks.
   * @param canvasAndContext - The canvas and context to return to the pool
   */
  returnCanvasAndContext(canvasAndContext) {
    CanvasPool/* CanvasPool */.N.returnCanvasAndContext(canvasAndContext);
  }
  /**
   * Renders text to its canvas, and updates its texture.
   * @param text - The text to render
   * @param style - The style of the text
   * @param padding - The padding of the text
   * @param resolution - The resolution of the text
   * @param canvasAndContext - The canvas and context to render the text to
   */
  _renderTextToCanvas(text, style, padding, resolution, canvasAndContext) {
    const { canvas, context } = canvasAndContext;
    const font = (0,fontStringFromTextStyle/* fontStringFromTextStyle */.Z)(style);
    const measured = CanvasTextMetrics/* CanvasTextMetrics */.P.measureText(text || " ", style);
    const lines = measured.lines;
    const lineHeight = measured.lineHeight;
    const lineWidths = measured.lineWidths;
    const maxLineWidth = measured.maxLineWidth;
    const fontProperties = measured.fontProperties;
    const height = canvas.height;
    context.resetTransform();
    context.scale(resolution, resolution);
    context.textBaseline = style.textBaseline;
    if (style._stroke?.width) {
      const strokeStyle = style._stroke;
      context.lineWidth = strokeStyle.width;
      context.miterLimit = strokeStyle.miterLimit;
      context.lineJoin = strokeStyle.join;
      context.lineCap = strokeStyle.cap;
    }
    context.font = font;
    let linePositionX;
    let linePositionY;
    const passesCount = style.dropShadow ? 2 : 1;
    for (let i = 0; i < passesCount; ++i) {
      const isShadowPass = style.dropShadow && i === 0;
      const dsOffsetText = isShadowPass ? Math.ceil(Math.max(1, height) + padding * 2) : 0;
      const dsOffsetShadow = dsOffsetText * resolution;
      if (isShadowPass) {
        context.fillStyle = "black";
        context.strokeStyle = "black";
        const shadowOptions = style.dropShadow;
        const dropShadowColor = shadowOptions.color;
        const dropShadowAlpha = shadowOptions.alpha;
        context.shadowColor = Color/* Color */.Q.shared.setValue(dropShadowColor).setAlpha(dropShadowAlpha).toRgbaString();
        const dropShadowBlur = shadowOptions.blur * resolution;
        const dropShadowDistance = shadowOptions.distance * resolution;
        context.shadowBlur = dropShadowBlur;
        context.shadowOffsetX = Math.cos(shadowOptions.angle) * dropShadowDistance;
        context.shadowOffsetY = Math.sin(shadowOptions.angle) * dropShadowDistance + dsOffsetShadow;
      } else {
        context.fillStyle = style._fill ? (0,getCanvasFillStyle/* getCanvasFillStyle */.r)(style._fill, context, measured, padding * 2) : null;
        if (style._stroke?.width) {
          const strokePadding = style._stroke.width * 0.5 + padding * 2;
          context.strokeStyle = (0,getCanvasFillStyle/* getCanvasFillStyle */.r)(style._stroke, context, measured, strokePadding);
        }
        context.shadowColor = "black";
      }
      let linePositionYShift = (lineHeight - fontProperties.fontSize) / 2;
      if (lineHeight - fontProperties.fontSize < 0) {
        linePositionYShift = 0;
      }
      const strokeWidth = style._stroke?.width ?? 0;
      for (let i2 = 0; i2 < lines.length; i2++) {
        linePositionX = strokeWidth / 2;
        linePositionY = strokeWidth / 2 + i2 * lineHeight + fontProperties.ascent + linePositionYShift;
        if (style.align === "right") {
          linePositionX += maxLineWidth - lineWidths[i2];
        } else if (style.align === "center") {
          linePositionX += (maxLineWidth - lineWidths[i2]) / 2;
        }
        if (style._stroke?.width) {
          this._drawLetterSpacing(
            lines[i2],
            style,
            canvasAndContext,
            linePositionX + padding,
            linePositionY + padding - dsOffsetText,
            true
          );
        }
        if (style._fill !== void 0) {
          this._drawLetterSpacing(
            lines[i2],
            style,
            canvasAndContext,
            linePositionX + padding,
            linePositionY + padding - dsOffsetText
          );
        }
      }
    }
  }
  /**
   * Render the text with letter-spacing.
   *
   * This method handles rendering text with the correct letter spacing, using either:
   * 1. Native letter spacing if supported by the browser
   * 2. Manual letter spacing calculation if not natively supported
   *
   * For manual letter spacing, it calculates the position of each character
   * based on its width and the desired spacing.
   * @param text - The text to draw
   * @param style - The text style to apply
   * @param canvasAndContext - The canvas and context to draw to
   * @param x - Horizontal position to draw the text
   * @param y - Vertical position to draw the text
   * @param isStroke - Whether to render the stroke (true) or fill (false)
   * @private
   */
  _drawLetterSpacing(text, style, canvasAndContext, x, y, isStroke = false) {
    const { context } = canvasAndContext;
    const letterSpacing = style.letterSpacing;
    let useExperimentalLetterSpacing = false;
    if (CanvasTextMetrics/* CanvasTextMetrics */.P.experimentalLetterSpacingSupported) {
      if (CanvasTextMetrics/* CanvasTextMetrics */.P.experimentalLetterSpacing) {
        context.letterSpacing = `${letterSpacing}px`;
        context.textLetterSpacing = `${letterSpacing}px`;
        useExperimentalLetterSpacing = true;
      } else {
        context.letterSpacing = "0px";
        context.textLetterSpacing = "0px";
      }
    }
    if (letterSpacing === 0 || useExperimentalLetterSpacing) {
      if (isStroke) {
        context.strokeText(text, x, y);
      } else {
        context.fillText(text, x, y);
      }
      return;
    }
    let currentPosition = x;
    const stringArray = CanvasTextMetrics/* CanvasTextMetrics */.P.graphemeSegmenter(text);
    let previousWidth = context.measureText(text).width;
    let currentWidth = 0;
    for (let i = 0; i < stringArray.length; ++i) {
      const currentChar = stringArray[i];
      if (isStroke) {
        context.strokeText(currentChar, currentPosition, y);
      } else {
        context.fillText(currentChar, currentPosition, y);
      }
      let textStr = "";
      for (let j = i + 1; j < stringArray.length; ++j) {
        textStr += stringArray[j];
      }
      currentWidth = context.measureText(textStr).width;
      currentPosition += previousWidth - currentWidth + letterSpacing;
      previousWidth = currentWidth;
    }
  }
}
const CanvasTextGenerator = new CanvasTextGeneratorClass();


//# sourceMappingURL=CanvasTextGenerator.mjs.map

;// ./node_modules/pixi.js/lib/scene/text/canvas/CanvasTextSystem.mjs








"use strict";
class CanvasTextSystem {
  constructor(_renderer) {
    this._activeTextures = {};
    this._renderer = _renderer;
  }
  getTexture(options, _resolution, _style, _textKey) {
    if (typeof options === "string") {
      (0,deprecation/* deprecation */.t6)("8.0.0", "CanvasTextSystem.getTexture: Use object TextOptions instead of separate arguments");
      options = {
        text: options,
        style: _style,
        resolution: _resolution
      };
    }
    if (!(options.style instanceof TextStyle/* TextStyle */.x)) {
      options.style = new TextStyle/* TextStyle */.x(options.style);
    }
    if (!(options.textureStyle instanceof TextureStyle/* TextureStyle */.n)) {
      options.textureStyle = new TextureStyle/* TextureStyle */.n(options.textureStyle);
    }
    if (typeof options.text !== "string") {
      options.text = options.text.toString();
    }
    const { text, style, textureStyle } = options;
    const resolution = options.resolution ?? this._renderer.resolution;
    const { frame, canvasAndContext } = CanvasTextGenerator.getCanvasAndContext({
      text,
      style,
      resolution
    });
    const texture = (0,getPo2TextureFromSource/* getPo2TextureFromSource */.M)(canvasAndContext.canvas, frame.width, frame.height, resolution);
    if (textureStyle)
      texture.source.style = textureStyle;
    if (style.trim) {
      frame.pad(style.padding);
      texture.frame.copyFrom(frame);
      texture.frame.scale(1 / resolution);
      texture.updateUvs();
    }
    if (style.filters) {
      const filteredTexture = this._applyFilters(texture, style.filters);
      this.returnTexture(texture);
      CanvasTextGenerator.returnCanvasAndContext(canvasAndContext);
      return filteredTexture;
    }
    this._renderer.texture.initSource(texture._source);
    CanvasTextGenerator.returnCanvasAndContext(canvasAndContext);
    return texture;
  }
  /**
   * Returns a texture that was created wit the above `getTexture` function.
   * Handy if you are done with a texture and want to return it to the pool.
   * @param texture - The texture to be returned.
   */
  returnTexture(texture) {
    const source = texture.source;
    source.resource = null;
    source.uploadMethodId = "unknown";
    source.alphaMode = "no-premultiply-alpha";
    TexturePool/* TexturePool */.W.returnTexture(texture, true);
  }
  /**
   * Renders text to its canvas, and updates its texture.
   * @deprecated since 8.10.0
   */
  renderTextToCanvas() {
    (0,deprecation/* deprecation */.t6)(
      "8.10.0",
      "CanvasTextSystem.renderTextToCanvas: no longer supported, use CanvasTextSystem.getTexture instead"
    );
  }
  /**
   * Gets or creates a managed texture for a Text object. This method handles texture reuse and reference counting.
   * @param text - The Text object that needs a texture
   * @returns A Texture instance that represents the rendered text
   * @remarks
   * This method performs the following:
   * 1. Sets the appropriate resolution based on auto-resolution settings
   * 2. Checks if a texture already exists for the text's style
   * 3. Creates a new texture if needed or returns an existing one
   * 4. Manages reference counting for texture reuse
   */
  getManagedTexture(text) {
    text._resolution = text._autoResolution ? this._renderer.resolution : text.resolution;
    const textKey = text.styleKey;
    if (this._activeTextures[textKey]) {
      this._increaseReferenceCount(textKey);
      return this._activeTextures[textKey].texture;
    }
    const texture = this.getTexture({
      text: text.text,
      style: text.style,
      resolution: text._resolution,
      textureStyle: text.textureStyle
    });
    this._activeTextures[textKey] = {
      texture,
      usageCount: 1
    };
    return texture;
  }
  /**
   * Decreases the reference count for a texture associated with a text key.
   * When the reference count reaches zero, the texture is returned to the pool.
   * @param textKey - The unique key identifying the text style configuration
   * @remarks
   * This method is crucial for memory management, ensuring textures are properly
   * cleaned up when they are no longer needed by any Text instances.
   */
  decreaseReferenceCount(textKey) {
    const activeTexture = this._activeTextures[textKey];
    activeTexture.usageCount--;
    if (activeTexture.usageCount === 0) {
      this.returnTexture(activeTexture.texture);
      this._activeTextures[textKey] = null;
    }
  }
  /**
   * Gets the current reference count for a texture associated with a text key.
   * @param textKey - The unique key identifying the text style configuration
   * @returns The number of Text instances currently using this texture
   */
  getReferenceCount(textKey) {
    return this._activeTextures[textKey]?.usageCount ?? 0;
  }
  _increaseReferenceCount(textKey) {
    this._activeTextures[textKey].usageCount++;
  }
  /**
   * Applies the specified filters to the given texture.
   *
   * This method takes a texture and a list of filters, applies the filters to the texture,
   * and returns the resulting texture. It also ensures that the alpha mode of the resulting
   * texture is set to 'premultiplied-alpha'.
   * @param {Texture} texture - The texture to which the filters will be applied.
   * @param {Filter[]} filters - The filters to apply to the texture.
   * @returns {Texture} The resulting texture after all filters have been applied.
   */
  _applyFilters(texture, filters) {
    const currentRenderTarget = this._renderer.renderTarget.renderTarget;
    const resultTexture = this._renderer.filter.generateFilteredTexture({
      texture,
      filters
    });
    this._renderer.renderTarget.bind(currentRenderTarget, false);
    return resultTexture;
  }
  destroy() {
    this._renderer = null;
    for (const key in this._activeTextures) {
      if (this._activeTextures[key])
        this.returnTexture(this._activeTextures[key].texture);
    }
    this._activeTextures = null;
  }
}
/** @ignore */
CanvasTextSystem.extension = {
  type: [
    Extensions/* ExtensionType */.Ag.WebGLSystem,
    Extensions/* ExtensionType */.Ag.WebGPUSystem,
    Extensions/* ExtensionType */.Ag.CanvasSystem
  ],
  name: "canvasText"
};


//# sourceMappingURL=CanvasTextSystem.mjs.map

;// ./node_modules/pixi.js/lib/scene/text/init.mjs




"use strict";
Extensions/* extensions */.XO.add(CanvasTextSystem);
Extensions/* extensions */.XO.add(CanvasTextPipe);
//# sourceMappingURL=init.mjs.map


/***/ },

/***/ 2558
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   M: () => (/* binding */ getPo2TextureFromSource)
/* harmony export */ });
/* harmony import */ var _rendering_renderers_shared_texture_TexturePool_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2437);
/* harmony import */ var _container_bounds_Bounds_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(9636);



"use strict";
const tempBounds = new _container_bounds_Bounds_mjs__WEBPACK_IMPORTED_MODULE_1__/* .Bounds */ .c();
function getPo2TextureFromSource(image, width, height, resolution) {
  const bounds = tempBounds;
  bounds.minX = 0;
  bounds.minY = 0;
  bounds.maxX = image.width / resolution | 0;
  bounds.maxY = image.height / resolution | 0;
  const texture = _rendering_renderers_shared_texture_TexturePool_mjs__WEBPACK_IMPORTED_MODULE_0__/* .TexturePool */ .W.getOptimalTexture(
    bounds.width,
    bounds.height,
    resolution,
    false
  );
  texture.source.uploadMethodId = "image";
  texture.source.resource = image;
  texture.source.alphaMode = "premultiply-alpha-on-upload";
  texture.frame.width = width / resolution;
  texture.frame.height = height / resolution;
  texture.source.emit("update", texture.source);
  texture.updateUvs();
  return texture;
}


//# sourceMappingURL=getPo2TextureFromSource.mjs.map


/***/ },

/***/ 2289
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   s: () => (/* binding */ updateTextBounds)
/* harmony export */ });
/* harmony import */ var _utils_data_updateQuadBounds_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2048);


"use strict";
function updateTextBounds(batchableSprite, text) {
  const { texture, bounds } = batchableSprite;
  const padding = text._style._getFinalPadding();
  (0,_utils_data_updateQuadBounds_mjs__WEBPACK_IMPORTED_MODULE_0__/* .updateQuadBounds */ .y)(bounds, text._anchor, texture);
  const paddingOffset = text._anchor._x * padding * 2;
  const paddingOffsetY = text._anchor._y * padding * 2;
  bounds.minX -= padding - paddingOffset;
  bounds.minY -= padding - paddingOffsetY;
  bounds.maxX -= padding - paddingOffset;
  bounds.maxY -= padding - paddingOffsetY;
}


//# sourceMappingURL=updateTextBounds.mjs.map


/***/ },

/***/ 5957
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   g: () => (/* binding */ lru)
/* harmony export */ });
/* unused harmony export LRU */
/**
 * tiny-lru
 *
 * @copyright 2026 Jason Mulligan <jason.mulligan@avoidwork.com>
 * @license BSD-3-Clause
 * @version 11.4.7
 */
/**
 * A high-performance Least Recently Used (LRU) cache implementation with optional TTL support.
 * Items are automatically evicted when the cache reaches its maximum size,
 * removing the least recently used items first. All core operations (get, set, delete) are O(1).
 *
 * @class LRU
 * @example
 * // Create a cache with max 100 items
 * const cache = new LRU(100);
 * cache.set('key1', 'value1');
 * console.log(cache.get('key1')); // 'value1'
 *
 * @example
 * // Create a cache with TTL
 * const cache = new LRU(100, 5000); // 5 second TTL
 * cache.set('key1', 'value1');
 * // After 5 seconds, key1 will be expired
 */
class LRU {
	/**
	 * Creates a new LRU cache instance.
	 * Note: Constructor does not validate parameters. Use lru() factory function for parameter validation.
	 *
	 * @constructor
	 * @param {number} [max=0] - Maximum number of items to store. 0 means unlimited.
	 * @param {number} [ttl=0] - Time to live in milliseconds. 0 means no expiration.
	 * @param {boolean} [resetTtl=false] - Whether to reset TTL when accessing existing items via get().
	 * @example
	 * const cache = new LRU(1000, 60000, true); // 1000 items, 1 minute TTL, reset on access
	 * @see {@link lru} For parameter validation
	 * @since 1.0.0
	 */
	constructor (max = 0, ttl = 0, resetTtl = false) {
		this.first = null;
		this.items = Object.create(null);
		this.last = null;
		this.max = max;
		this.resetTtl = resetTtl;
		this.size = 0;
		this.ttl = ttl;
	}

	/**
	 * Removes all items from the cache.
	 *
	 * @method clear
	 * @memberof LRU
	 * @returns {LRU} The LRU instance for method chaining.
	 * @example
	 * cache.clear();
	 * console.log(cache.size); // 0
	 * @since 1.0.0
	 */
	clear () {
		this.first = null;
		this.items = Object.create(null);
		this.last = null;
		this.size = 0;

		return this;
	}

	/**
	 * Removes an item from the cache by key.
	 *
	 * @method delete
	 * @memberof LRU
	 * @param {string} key - The key of the item to delete.
	 * @returns {LRU} The LRU instance for method chaining.
	 * @example
	 * cache.set('key1', 'value1');
	 * cache.delete('key1');
	 * console.log(cache.has('key1')); // false
	 * @see {@link LRU#has}
	 * @see {@link LRU#clear}
	 * @since 1.0.0
	 */
	delete (key) {
		if (this.has(key)) {
			const item = this.items[key];

			delete this.items[key];
			this.size--;

			if (item.prev !== null) {
				item.prev.next = item.next;
			}

			if (item.next !== null) {
				item.next.prev = item.prev;
			}

			if (this.first === item) {
				this.first = item.next;
			}

			if (this.last === item) {
				this.last = item.prev;
			}
		}

		return this;
	}

	/**
	 * Returns an array of [key, value] pairs for the specified keys.
	 * Order follows LRU order (least to most recently used).
	 *
	 * @method entries
	 * @memberof LRU
	 * @param {string[]} [keys=this.keys()] - Array of keys to get entries for. Defaults to all keys.
	 * @returns {Array<Array<*>>} Array of [key, value] pairs in LRU order.
	 * @example
	 * cache.set('a', 1).set('b', 2);
	 * console.log(cache.entries()); // [['a', 1], ['b', 2]]
	 * console.log(cache.entries(['a'])); // [['a', 1]]
	 * @see {@link LRU#keys}
	 * @see {@link LRU#values}
	 * @since 11.1.0
	 */
	entries (keys = this.keys()) {
		const result = new Array(keys.length);
		for (let i = 0; i < keys.length; i++) {
			const key = keys[i];
			result[i] = [key, this.get(key)];
		}

		return result;
	}

	/**
	 * Removes the least recently used item from the cache.
	 *
	 * @method evict
	 * @memberof LRU
	 * @param {boolean} [bypass=false] - Whether to force eviction even when cache is empty.
	 * @returns {LRU} The LRU instance for method chaining.
	 * @example
	 * cache.set('old', 'value').set('new', 'value');
	 * cache.evict(); // Removes 'old' item
	 * @see {@link LRU#setWithEvicted}
	 * @since 1.0.0
	 */
	evict (bypass = false) {
		if (bypass || this.size > 0) {
			const item = this.first;

			delete this.items[item.key];

			if (--this.size === 0) {
				this.first = null;
				this.last = null;
			} else {
				this.first = item.next;
				this.first.prev = null;
			}
		}

		return this;
	}

	/**
	 * Returns the expiration timestamp for a given key.
	 *
	 * @method expiresAt
	 * @memberof LRU
	 * @param {string} key - The key to check expiration for.
	 * @returns {number|undefined} The expiration timestamp in milliseconds, or undefined if key doesn't exist.
	 * @example
	 * const cache = new LRU(100, 5000); // 5 second TTL
	 * cache.set('key1', 'value1');
	 * console.log(cache.expiresAt('key1')); // timestamp 5 seconds from now
	 * @see {@link LRU#get}
	 * @see {@link LRU#has}
	 * @since 1.0.0
	 */
	expiresAt (key) {
		let result;

		if (this.has(key)) {
			result = this.items[key].expiry;
		}

		return result;
	}

	/**
	 * Retrieves a value from the cache by key. Updates the item's position to most recently used.
	 *
	 * @method get
	 * @memberof LRU
	 * @param {string} key - The key to retrieve.
	 * @returns {*} The value associated with the key, or undefined if not found or expired.
	 * @example
	 * cache.set('key1', 'value1');
	 * console.log(cache.get('key1')); // 'value1'
	 * console.log(cache.get('nonexistent')); // undefined
	 * @see {@link LRU#set}
	 * @see {@link LRU#has}
	 * @since 1.0.0
	 */
	get (key) {
		const item = this.items[key];

		if (item !== undefined) {
			// Check TTL only if enabled to avoid unnecessary Date.now() calls
			if (this.ttl > 0) {
				if (item.expiry <= Date.now()) {
					this.delete(key);

					return undefined;
				}
			}

			// Fast LRU update without full set() overhead
			this.moveToEnd(item);

			return item.value;
		}

		return undefined;
	}

	/**
	 * Checks if a key exists in the cache.
	 *
	 * @method has
	 * @memberof LRU
	 * @param {string} key - The key to check for.
	 * @returns {boolean} True if the key exists, false otherwise.
	 * @example
	 * cache.set('key1', 'value1');
	 * console.log(cache.has('key1')); // true
	 * console.log(cache.has('nonexistent')); // false
	 * @see {@link LRU#get}
	 * @see {@link LRU#delete}
	 * @since 9.0.0
	 */
	has (key) {
		return key in this.items;
	}

	/**
	 * Efficiently moves an item to the end of the LRU list (most recently used position).
	 * This is an internal optimization method that avoids the overhead of the full set() operation
	 * when only LRU position needs to be updated.
	 *
	 * @method moveToEnd
	 * @memberof LRU
	 * @param {Object} item - The cache item with prev/next pointers to reposition.
	 * @private
	 * @since 11.3.5
	 */
	moveToEnd (item) {
		// If already at the end, nothing to do
		if (this.last === item) {
			return;
		}

		// Remove item from current position in the list
		if (item.prev !== null) {
			item.prev.next = item.next;
		}

		if (item.next !== null) {
			item.next.prev = item.prev;
		}

		// Update first pointer if this was the first item
		if (this.first === item) {
			this.first = item.next;
		}

		// Add item to the end
		item.prev = this.last;
		item.next = null;

		if (this.last !== null) {
			this.last.next = item;
		}

		this.last = item;

		// Handle edge case: if this was the only item, it's also first
		if (this.first === null) {
			this.first = item;
		}
	}

	/**
	 * Returns an array of all keys in the cache, ordered from least to most recently used.
	 *
	 * @method keys
	 * @memberof LRU
	 * @returns {string[]} Array of keys in LRU order.
	 * @example
	 * cache.set('a', 1).set('b', 2);
	 * cache.get('a'); // Move 'a' to most recent
	 * console.log(cache.keys()); // ['b', 'a']
	 * @see {@link LRU#values}
	 * @see {@link LRU#entries}
	 * @since 9.0.0
	 */
	keys () {
		const result = new Array(this.size);
		let x = this.first;
		let i = 0;

		while (x !== null) {
			result[i++] = x.key;
			x = x.next;
		}

		return result;
	}

	/**
	 * Sets a value in the cache and returns any evicted item.
	 *
	 * @method setWithEvicted
	 * @memberof LRU
	 * @param {string} key - The key to set.
	 * @param {*} value - The value to store.
	 * @param {boolean} [resetTtl=this.resetTtl] - Whether to reset the TTL for this operation.
	 * @returns {Object|null} The evicted item (if any) with shape {key, value, expiry, prev, next}, or null.
	 * @example
	 * const cache = new LRU(2);
	 * cache.set('a', 1).set('b', 2);
	 * const evicted = cache.setWithEvicted('c', 3); // evicted = {key: 'a', value: 1, ...}
	 * @see {@link LRU#set}
	 * @see {@link LRU#evict}
	 * @since 11.3.0
	 */
	setWithEvicted (key, value, resetTtl = this.resetTtl) {
		let evicted = null;

		if (this.has(key)) {
			this.set(key, value, true, resetTtl);
		} else {
			if (this.max > 0 && this.size === this.max) {
				evicted = {...this.first};
				this.evict(true);
			}

			let item = this.items[key] = {
				expiry: this.ttl > 0 ? Date.now() + this.ttl : this.ttl,
				key: key,
				prev: this.last,
				next: null,
				value
			};

			if (++this.size === 1) {
				this.first = item;
			} else {
				this.last.next = item;
			}

			this.last = item;
		}

		return evicted;
	}

	/**
	 * Sets a value in the cache. Updates the item's position to most recently used.
	 *
	 * @method set
	 * @memberof LRU
	 * @param {string} key - The key to set.
	 * @param {*} value - The value to store.
	 * @param {boolean} [bypass=false] - Internal parameter for setWithEvicted method.
	 * @param {boolean} [resetTtl=this.resetTtl] - Whether to reset the TTL for this operation.
	 * @returns {LRU} The LRU instance for method chaining.
	 * @example
	 * cache.set('key1', 'value1')
	 *      .set('key2', 'value2')
	 *      .set('key3', 'value3');
	 * @see {@link LRU#get}
	 * @see {@link LRU#setWithEvicted}
	 * @since 1.0.0
	 */
	set (key, value, bypass = false, resetTtl = this.resetTtl) {
		let item = this.items[key];

		if (bypass || item !== undefined) {
			// Existing item: update value and position
			item.value = value;

			if (bypass === false && resetTtl) {
				item.expiry = this.ttl > 0 ? Date.now() + this.ttl : this.ttl;
			}

			// Always move to end, but the bypass parameter affects TTL reset behavior
			this.moveToEnd(item);
		} else {
			// New item: check for eviction and create
			if (this.max > 0 && this.size === this.max) {
				this.evict(true);
			}

			item = this.items[key] = {
				expiry: this.ttl > 0 ? Date.now() + this.ttl : this.ttl,
				key: key,
				prev: this.last,
				next: null,
				value
			};

			if (++this.size === 1) {
				this.first = item;
			} else {
				this.last.next = item;
			}

			this.last = item;
		}

		return this;
	}

	/**
	 * Returns an array of all values in the cache for the specified keys.
	 * Order follows LRU order (least to most recently used).
	 *
	 * @method values
	 * @memberof LRU
	 * @param {string[]} [keys=this.keys()] - Array of keys to get values for. Defaults to all keys.
	 * @returns {Array<*>} Array of values corresponding to the keys in LRU order.
	 * @example
	 * cache.set('a', 1).set('b', 2);
	 * console.log(cache.values()); // [1, 2]
	 * console.log(cache.values(['a'])); // [1]
	 * @see {@link LRU#keys}
	 * @see {@link LRU#entries}
	 * @since 11.1.0
	 */
	values (keys = this.keys()) {
		const result = new Array(keys.length);
		for (let i = 0; i < keys.length; i++) {
			result[i] = this.get(keys[i]);
		}

		return result;
	}
}

/**
 * Factory function to create a new LRU cache instance with parameter validation.
 *
 * @function lru
 * @param {number} [max=1000] - Maximum number of items to store. Must be >= 0. Use 0 for unlimited size.
 * @param {number} [ttl=0] - Time to live in milliseconds. Must be >= 0. Use 0 for no expiration.
 * @param {boolean} [resetTtl=false] - Whether to reset TTL when accessing existing items via get().
 * @returns {LRU} A new LRU cache instance.
 * @throws {TypeError} When parameters are invalid (negative numbers or wrong types).
 * @example
 * // Create cache with factory function
 * const cache = lru(100, 5000, true);
 * cache.set('key', 'value');
 *
 * @example
 * // Error handling
 * try {
 *   const cache = lru(-1); // Invalid max
 * } catch (error) {
 *   console.error(error.message); // "Invalid max value"
 * }
 * @see {@link LRU}
 * @since 1.0.0
 */
function lru (max = 1000, ttl = 0, resetTtl = false) {
	if (isNaN(max) || max < 0) {
		throw new TypeError("Invalid max value");
	}

	if (isNaN(ttl) || ttl < 0) {
		throw new TypeError("Invalid ttl value");
	}

	if (typeof resetTtl !== "boolean") {
		throw new TypeError("Invalid resetTtl value");
	}

	return new LRU(max, ttl, resetTtl);
}

/***/ }

}]);
//# sourceMappingURL=897.bundle.js.map