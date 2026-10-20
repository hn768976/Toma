# Styles in claude-drawing-skill

Pinned commit: `24418f3f61963ea6c4964537dad732c4ad7467c6`

The repo was advertised with 63 styles; at this commit SKILL.md says **74** (seventy-four).
Every style is a Python class you drive with your own scene script (pixel coordinates); there is no
"apply style X to scene Y" switch. Common parameters: `W, H` (canvas size), `seed` (all randomness
comes from `np.random.default_rng(seed)`), plus per-style knobs below (supersampling `ss`, tile/cell size,
misregistration, screen pitch, pen width, light direction, paper tone). Palettes are passed per call
(colour arguments to glaze/fill/stroke methods), not as a global palette option.

| # | Style (repo display name) | 中文 | lib | Class | Constructor parameters | Benchmark example | Repo time |
|---|---|---|---|---|---|---|---|
| 1 | Ink wash | 水墨 | `inkpaint` | `Painting` | `W=1920, H=1080, seed=0` | `bawansiqian.py` | 约 4 秒 |
| 2 | Watercolour | 水彩 | `watercolor` | `Watercolor` | `W=1920, H=1080, seed=0, paper_tone='#fbf8f1'` | `watercolor_autumn.py` | 约 15 秒 / 4 秒 |
| 3 | Paper collage | 剪纸拼贴 | `papercut` | `Collage` | `W=1920, H=1080, seed=0` | `papercut_balloons.py` | 约 30 秒 |
| 4 | Coloured pencil | 韩国彩铅 | `colorpencil` | `ColorPencil` | `W=1920, H=1080, seed=0, paper_tone='#fcf8f0'` | `colorpencil_dessert.py` | 约 17 秒 |
| 5 | Anime | 日本动漫 | `anime` | `Anime` | `W=1920, H=1080, seed=0` | `anime_summer.py` | 约 30 秒 |
| 6 | Editorial | 编辑风手绘 | `editorial` | `Editorial` | `W=1920, H=1080, seed=0, stock='#f4eee3', misreg=3.0` | `editorial_ideas.py` | 约 11 秒 |
| 7 | Impasto oil | 油画厚涂 | `oilpaint` | `OilPainting` | `W=1920, H=1080, seed=0` | `oil_wheatfield.py` | 约 2 秒 |
| 8 | Ukiyo-e | 浮世绘木版画 | `ukiyoe` | `Ukiyoe` | `W=1920, H=1080, seed=0, washi='#efe2c4'` | `ukiyoe_fuji.py` | 约 7 秒 |
| 9 | Pixel art | 像素风 | `pixelart` | `PixelArt` | `w=320, h=180, scale=6, seed=0, bg='#000000'` | `pixel_rainy_cafe.py` | 约 0.1 秒 |
| 10 | Stop-motion clay | 黏土定格 | `clay` | `Clay` | `W=1920, H=1080, seed=0, light=(-0.5, -0.62, 0.6), backdrop='#d9dccb'` | `clay_lighthouse.py` | 约 6 秒 |
| 11 | Cyanotype | 蓝晒 | `cyanotype` | `Cyanotype` | `W=1920, H=1080, seed=0, paper='#f4f1e7', ramp=None, strength=3.0` | `cyanotype_botanicals.py` | 约 6 秒 |
| 12 | Cross-stitch | 十字绣 | `stitch` | `Stitch` | `W=1920, H=1080, cell=12, seed=0, cloth='#efe7d4', light=(-0.5, -0.62, 0.6)` | `stitch_sampler.py` | 约 20 秒 |
| 13 | Retro panel | 复古仪器面板 | `panel` | `Panel` | `W=1920, H=1080, seed=0, light=(-0.5, -0.62, 0.6)` | `panel_radio.py` | 约 7 秒 |
| 14 | Sticker collage × receipt | 贴纸拼贴 | `sticker` | `Sticker` | `W=1920, H=1080, seed=0, light=(-0.5, -0.62, 0.6)` | `sticker_market.py` | 约 3 秒 |
| 15 | Lab notebook × stickers | 实验笔记本 | `notebook` | `Notebook` | `W=1920, H=1080, seed=0, light=(-0.45, -0.6, 0.66)` | `notebook_brewing.py` | 约 3 秒 |
| 16 | Chalkboard | 黑板板书 | `chalk` | `Chalkboard` | `W=1920, H=1080, seed=0, light=(-0.3, -0.8, 0.52)` | `chalk_lesson.py` | 约 5 秒 |
| 17 | Cyberpunk | 赛博朋克 | `cyberpunk` | `Cyberpunk` | `W=1920, H=1080, seed=0, focal=1150.0, vp=None, eye=1.7, fog=150.0, wall=9.5, road=6.0, ambient='#3a4266', fog_colour='#1c2140', record=True` | `cyberpunk_neon_street.py` | 约 10 秒 |
| 18 | Hand-drawn cartoon | 卡通手绘（逐帧手绘） | `cartoon` | `Cartoon` | `W=1920, H=1080, seed=0, boil=1.8, slop=3.5, rough=True, light=(-0.55, -0.83)` | `cartoon_toaster.py` | 约 4 秒 |
| 19 | Isometric 2.5D | 等轴 2.5D | `isometric` | `Isometric` | `W=1920, H=1080, seed=0, scale=72.0, look=(5.0, 5.0, 0.0), at=(0.56, 0.52), bounds=(-3, -3, -1.6, 13, 13, 8), sun=(0.36, -0.72, 0.52), ss=2, floor=-2.4, record=True, elevation=35.264, azimuth=45.0` | `isometric_weather_island.py` | 约 5 秒 |
| 20 | Continuous line art | 单线画 | `lineart` | `LineArt` | `W=1920, H=1080, seed=0, ss=4` | `lineart_paper_plane.py` | 约 6 秒 |
| 21 | Soft 3D | 柔光 3D | `soft3d` | `Soft3D` | `W=1920, H=1080, seed=0, eye=(0, 2.0, -6.0), target=(0, 0.5, 0), fov=30.0, floor=0.0, preview=0.5, record=True` | `soft3d_rise.py` | 约 46 秒 |
| 22 | Shape morph | 形变动画 | `morph` | `Morph` | `W=1920, H=1080, seed=0, ss=4` | `morph_water_cycle.py` | 约 1 秒 |
| 23 | Newspaper collage | 报刊拼贴 | `newscollage` | `NewsCollage` | `W=1920, H=1080, seed=0, light=(-0.5, -0.7, 0.5)` | `newscollage_curiosity.py` | 约 3 秒 |
| 24 | Aurora glass | 弥散玻璃 | `aurora` | `Aurora` | `W=1920, H=1080, seed=0, light=LIGHT` | `aurora_morning.py` | 约 2 秒 |
| 25 | Bauhaus geometric | 包豪斯几何 | `bauhaus` | `Bauhaus` | `W=1920, H=1080, seed=0, misreg=2.6, pull=90.0` | `bauhaus_form_colour.py` | 约 2 秒 |
| 26 | Retro synthwave | 复古 Synthwave | `synthwave` | `Synthwave` | `W=1920, H=1080, seed=0, horizon=None, vp_x=None, focal=1100.0, eye=3.5, record=True` | `synthwave_coastline.py` | 约 4 秒 |
| 27 | Perler beads | 拼豆 | `perler` | `Perler` | `W=1920, H=1080, seed=0, pitch=22.0, tilt=0.32, ss=2, light=(-350.0, -520.0, 2300.0)` | `perler_strawberry_coaster.py` | 约 9 秒 |
| 28 | Petroglyph | 岩画（凿刻砂岩） | `petroglyph` | `Petroglyph` | `W=1920, H=1080, seed=0, light=(-0.62, -0.5, 0.6)` | `petroglyph_migration.py` | 约 10 秒 |
| 29 | Egyptian tomb painting | 古埃及墓室壁画 | `tomb` | `TombPainting` | `W=1920, H=1080, seed=0, ss=3, light=(-0.6, -0.8)` | `tomb_harvest.py` | 约 4 秒 |
| 30 | Roman mosaic | 罗马马赛克 | `mosaic` | `Mosaic` | `W=1920, H=1080, seed=0, tile=13, gap=1.8, ss=2, light=(-0.52, -0.66, 0.54), bed='#d8cfbb', grout='#b3a892', stones=None` | `mosaic_harbor.py` | 约 12 秒 |
| 31 | Stained glass | 彩色玻璃花窗 | `stainedglass` | `StainedGlass` | `W=1920, H=1080, seed=0, record=True, ambient=0.05` | `stainedglass_seasons.py` | 约 4 秒 |
| 32 | Illuminated manuscript | 泥金手抄本 | `illuminated` | `Illuminated` | `W=1920, H=1080, seed=0, ss=3, nib_angle=40.0` | `illuminated_starchart.py` | 约 9 秒 |
| 33 | Leonardo codex | 达·芬奇手稿 | `codex` | `Codex` | `W=1920, H=1080, seed=0, ss=3, nib=35.0` | `codex_ornithopter.py` | 约 8 秒 |
| 34 | Silhouette | 剪影 | `silhouette` | `Silhouette` | `W=1920, H=1080, seed=0, light=(-0.5, -0.65, 0.58)` | `silhouette_family.py` | 约 3 秒 |
| 35 | Letterpress poster | 凸版印刷海报 | `letterpress` | `Letterpress` | `W=1920, H=1080, seed=0, misreg=3.2` | `letterpress_circus.py` | 约 6 秒 |
| 36 | Soviet constructivism | 苏联构成主义 | `constructivism` | `Constructivism` | `W=1920, H=1080, seed=0, misreg=2.4, red=RED, black=BLACK` | `constructivism_radio.py` | 约 6 秒 |
| 37 | Art Deco | 装饰艺术（Art Deco） | `artdeco` | `ArtDeco` | `W=1920, H=1080, seed=0, grain=1.0` | `artdeco_express.py` | 约 12 秒 |
| 38 | Golden-age comic | 黄金时代漫画 | `comic` | `ComicCover` | `W=1920, H=1080, seed=0, screen=11.0, misreg=4.0, slop=1.6, light=LIGHT` | `comic_rocket.py` | 约 5 秒 |
| 39 | Pop silkscreen | 波普丝网 | `popart` | `PopSilkscreen` | `W=1920, H=1080, seed=0, light=(-0.55, -0.8)` | `popart_cat_moods.py` | 约 3 秒 |
| 40 | ASCII art (line printer) | ASCII 字符画（行式打印机） | `lineprinter` | `LinePrinter` | `W=1920, H=1080, seed=0, cols=132, top=40.0, cpi=10, lpi=6, form_in=14.875, ss=2, ink=INK, sub=(6, 10), weight='bold', ppi=None, page_in=11.0` | `lineprinter_launch.py` | 约 2.3 秒 |
| 41 | Low poly | 低多边形（1999 年代 3D） | `lowpoly` | `LowPoly` | `W=1920, H=1080, scale=5, seed=0, record=True, zbuffer=False, near=0.6, far=260.0, bits=5, dither=True` | `lowpoly_canyon.py` | 约 0.2 秒 |
| 42 | Stencil graffiti | 喷漆模板涂鸦 | `stencil` | `Stencil` | `W=1920, H=1080, seed=0, light=(-0.58, -0.62, 0.53)` | `stencil_kite.py` | 约 6 秒 |
| 43 | Embroidered patches | 刺绣徽章 | `patch` | `Patch` | `W=1920, H=1080, seed=0, light=(-0.5, -0.62, 0.6)` | `patch_camping.py` | 约 6 秒 |
| 44 | Blueprint | 蓝图工程图 | `blueprint` | `Blueprint` | `W=1920, H=1080, seed=0, ss=3, tracing=None` | `blueprint_lighthouse.py` | 约 5 秒 |
| 45 | Children's crayon | 儿童蜡笔画 | `crayon` | `Crayon` | `W=1920, H=1080, seed=0, paper='#f7f3e9'` | `crayon_picnic.py` | 约 8 秒 |
| 46 | Green-screen CRT | 绿屏终端 CRT（荧光字符画） | `crt` | `CRTTerminal` | `W=1920, H=1080, seed=0, cols=120, rows=36, phosphor='green', opening=(88, 60, 1832, 958), radius=62, raster=(0.955, 0.93), curve=0.065, bezel=PUTTY` | `crt_weather.py` | 约 7 秒 |
| 47 | Thermal camera | 热成像 | `thermal` | `Thermal` | `W=1920, H=1080, sensor=(640, 360), ss=2, seed=0, ambient=21.0` | `thermal_kitchen.py` | 约 2 秒 |
| 48 | Delft tiles | 代尔夫特蓝瓷砖 | `delft` | `DelftTile` | `W=1920, H=1080, seed=0, tile=128, joint=3.6, origin=(0, 0), ss=3, glaze=(GLAZE_COOL, GLAZE_WARM), mortar=MORTAR, light=(-0.5, -0.6, 0.63)` | `delft_canal.py` | 约 6 秒 |
| 49 | Cave painting | 洞穴壁画（赭石颜料） | `cave` | `CavePainting` | `W=1920, H=1080, seed=0` | `cave_hunt.py` | 约 7 秒 |
| 50 | 1-bit paint program | 1-bit 早期画图软件 | `macpaint` | `MacPaint` | `seed=0, title='untitled', menus=('Paper', 'Tools', 'Brushes', 'Patterns', 'Type', 'Zoom'), screen=(640, 360), scale=3, ink='#000000', paper='#ffffff', doc=None, scroll=(0.0, 0.0)` | `macpaint_garden.py` | 约 0.4 秒 |
| 51 | Greek black-figure vase | 古希腊黑绘陶瓶 | `blackfigure` | `BlackFigure` | `W=1920, H=1080, seed=0` | `blackfigure_games.py` | 约 7 秒 |
| 52 | Graphite pencil | 铅笔素描 | `graphite` | `Graphite` | `W=1920, H=1080, seed=0, ss=2` | `graphite_bicycle.py` | 约 11 秒 |
| 53 | X-ray | X 光片 | `xray` | `XRay` | `W=1920, H=1080, px_cm=17.0, seed=0` | `xray_luggage.py` | 约 2 秒 |
| 54 | 1930s rubber hose | 1930 年代黑白橡皮管动画 | `rubberhose` | `RubberHose` | `W=1920, H=1080, seed=0, ss=2, ink_w=5.5` | `rubberhose_morning.py` | 约 3 秒 |
| 55 | Linocut | 黑白麻胶版画（linocut） | `linocut` | `Linocut` | `W=1920, H=1080, block=(100, 56, 1820, 918), seed=0, paper='#eee7d4', ink='#1c1a19', ss=2, rim=7` | `linocut_snowy_village.py` | 约 9 秒 |
| 56 | VHS home video | VHS 家庭录像 | `vhs` | `VHSCamcorder` | `W=1920, H=1080, seed=0, lines=480, samples=760, ss=2, keep_stages=True` | `vhs_birthday.py` | 约 6 秒 |
| 57 | Flat vector | 扁平矢量 | `flatvector` | `FlatVector` | `W=1920, H=1080, seed=0, light=(-0.7, -0.7)` | `flatvector_night_camp.py` | 约 1 秒 |
| 58 | Storybook animation | 绘本角色动画 | `storybook` | `Storybook` | `W=1920, H=1080, seed=0, actor_size=44.0` | `storybook_acorn.py` | 约 1 秒（总图）/ 约 3 秒（151 帧动图） |
| 59 | Ballpoint doodle | 圆珠笔涂鸦 | `ballpoint` | `Ballpoint` | `W=1920, H=1080, seed=0, ss=2, pen_width=2.5` | `ballpoint_board_game.py` | 约 4 秒 |
| 60 | Overlay sheets | 描图纸叠层 | `overlay` | `Overlay` | `W=1920, H=1080, seed=0, keep_stages=True` | `overlay_city_map.py` | 约 7 秒 |
| 61 | Pastel UI | 粉彩界面 | `pastelui` | `PastelUI` | `W=1920, H=1080, seed=0, keep_stages=True` | `pastelui_packing.py` | 约 0.5 秒（加 `--stages` 约 5 秒） |
| 62 | Exam grading | 阅卷批改 | `grading` | `Grading` | `W=1920, H=1080, seed=0, keep_stages=True, stages_dir=None` | `grading_math_quiz.py` | 约 1 秒（成品）/ 约 35 秒（含阶段） |
| 63 | Shadow puppetry | 皮影戏 | `shadowpuppet` | `ShadowPuppet` | `W=1920, H=1080, seed=0, keep_stages=True, stages_dir=None` | `shadowpuppet_cuju.py` | 约 7 秒（成品）/ 约 27 秒（含阶段） |
| 64 | Pen & wash | 钢笔淡彩 | `penwash` | `PenWash` | `W=1920, H=1080, seed=0, ss=2, keep_stages=True, stages_dir=None` | `penwash_neighbours.py` | 约 3 秒（成品）/ 约 6 秒（含阶段） |
| 65 | Retro gouache | 复古水粉 | `gouache` | `GouachePortrait` | `W=1920, H=1080, seed=0, keep_stages=True, stages_dir=None` | `gouache_rainy_day.py` | 约 7 秒（成品）/ 约 8 秒（含阶段） |
| 66 | Blue picture book | 蓝调绘本 | `bluebook` | `BlueBook` | `W=1920, H=1080, seed=0, keep_stages=True, stages_dir=None` | `bluebook_shared_umbrella.py` | 约 5 秒 |
| 67 | Jiangnan garden | 江南园林 | `jiangnan` | `JiangnanGarden` | `W=1920, H=1080, seed=0, keep_stages=True, stages_dir=None` | `jiangnan_spring_water.py` | 约 6 秒 |
| 68 | Dry-brush blocks | 干刷色块 | `drybrush` | `DryBrushBlocks` | `W=1600, H=1200, seed=0, keep_stages=True, stages_dir=None` | `drybrush_noodle_counter.py` | 约 5 秒 |
| 69 | Twilight storybook | 暮色微缩绘本 | `twilight` | `TwilightStorybook` | `W=2000, H=1100, seed=0, keep_stages=True, stages_dir=None` | `twilight_paper_kite.py` | 约 2 秒 |
| 70 | Hatched nocturne | 排线夜景 | `nocturne` | `Nocturne` | `W=1920, H=1080, seed=0, keep_stages=True, stages_dir=None` | `nocturne_lava_sea.py` | 约 9 秒 |
| 71 | Obsidian UI | 笔记应用界面 | `obsidianui` | `ObsidianUI` | `W=1920, H=1080, seed=0, keep_stages=True, accent='violet'` | `obsidianui_reading_notes.py` | 约 0.5 秒（加 `--stages` 约 5 秒） |
| 72 | Canvas board | 白板卡片 | `canvasboard` | `CanvasBoard` | `W=1920, H=1080, seed=0, keep_stages=True, stages_dir=None, window=None, tab='未命名.canvas', ribbon=True, controls=True, glow=True` | `canvasboard_moving_plan.py` | 约 0.6 秒（`--stages` 约 26 秒） |
| 73 | Flexoki paper | Flexoki 纸面 | `flexoki` | `FlexokiPaper` | `W=1920, H=1080, seed=0, keep_stages=True, theme='light'` | `flexoki_pour_over.py` | 约 0.3 秒 |
| 74 | Warm pencil storybook | 暖调彩铅绘本 | `pencilbook` | `PencilStorybook` | `W=1920, H=1080, seed=0, keep_stages=True, stages_dir=None` | `pencilbook_tortoise_crossing.py` | 约 40 秒 |

Total parsed: **74** style rows (ink wash and watercolour each have a second example).
