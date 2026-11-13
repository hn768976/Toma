import { Composition, Folder, Still } from 'remotion';
import { CityMapFull } from './comps/CityMapFull';
import { GPSTrack } from './comps/GPSTrack';
import { GPSAnalysis } from './comps/GPSAnalysis';
import { NightMap } from './comps/NightMap';
import { Flyover } from './comps/Flyover';
import { TargetLocator } from './comps/TargetLocator';

// Compositions are defined at 4K (3840x2160, 30 fps). Remotion IDs cannot
// contain "_", so GPSTrack_Teal is "GPSTrack-Teal" etc.; output files keep the "_" names.
const C = { fps: 30, width: 3840, height: 2160 } as const;

const LOOPS = [
  { id: 'GPSTrack-Teal', component: GPSTrack, props: { variant: 'teal' as const } },
  { id: 'GPSTrack-Interface', component: GPSTrack, props: { variant: 'interface' as const } },
  { id: 'NightMap-HUD', component: NightMap, props: {} },
  { id: 'TargetLocator-Grey', component: TargetLocator, props: { variant: 'grey' as const } },
  { id: 'TargetLocator-Red', component: TargetLocator, props: { variant: 'red' as const } },
] as const;

export const RemotionRoot = () => (
  <>
    {LOOPS.map((l) => (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <Composition key={l.id} id={l.id} component={l.component as any} durationInFrames={600} {...C} defaultProps={l.props} />
    ))}
    <Composition id="GPSAnalysis-Blue" component={GPSAnalysis} durationInFrames={600} {...C} defaultProps={{ variant: 'blue' as const }} />
    <Composition id="GPSAnalysis-Amber" component={GPSAnalysis} durationInFrames={600} {...C} defaultProps={{ variant: 'amber' as const }} />
    <Composition id="MapFlyover-Blue" component={Flyover} durationInFrames={600} {...C} defaultProps={{ variant: 'blue' as const }} />
    <Composition id="MapFlyover-Amber" component={Flyover} durationInFrames={600} {...C} defaultProps={{ variant: 'amber' as const }} />
    <Folder name="checks">
      {/* 601-frame versions of the loops: frame 600 must equal frame 0 */}
      {LOOPS.map((l) => (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <Composition key={l.id} id={`${l.id}-check601`} component={l.component as any} durationInFrames={601} {...C} defaultProps={l.props} />
      ))}
      <Still id="CityMapFull" component={CityMapFull} width={3840} height={2160} />
    </Folder>
  </>
);
