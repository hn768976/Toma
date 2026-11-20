import json, re, os
R='/home/user/Toma/'
def read(p): return open(R+p).read()
def lookdev_table(proj, title):
    out=[f'#### {title}: look-dev stills (start / peak / late)\n\n| measure | start ref / ours (diff) | peak ref / ours (diff) | late ref / ours (diff) |\n|---|---|---|---|\n']
    ms=[json.load(open(f'{R}{proj}/lookdev/measure-{n}.json')) for n in ('start','peak','late')]
    for i,row in enumerate(ms[0]['rows']):
        cells=[]
        for m in ms:
            k,rv,ov,diff,verdict=m['rows'][i]
            cells.append(f"{rv:.3f} / {ov:.3f} ({diff})"+('' if verdict=='ok' else ' **x**'))
        out.append(f"| {row[0]} | "+' | '.join(cells)+' |\n')
    out.append('| **outside target** | '+' | '.join(f"{m['fails']} of {len(m['rows'])}" for m in ms)+' |\n\n')
    return ''.join(out)
body=read('qc/report-head.md')+read('qc/report-mid.md')
body=body.replace('{{REF_LOOK}}', read('qc/reference-look.md'))
body=body.replace('{{LOOKDEV_A}}', lookdev_table('circuit-chip-beam','circuit-chip-beam'))
body=body.replace('{{LOOKDEV_B}}', lookdev_table('golden-hourglass','golden-hourglass'))
for n in ('01','02','03','04'): body=body.replace('{{LOOK_'+n+'}}', read(f'qc/look-{n}.md'))
open(R+'QC-report.md','w').write(body)
print(len(body))
