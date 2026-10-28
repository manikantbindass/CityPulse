"""Render an actual held-out-error comparison from the generated report."""
import json
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

root=Path(__file__).resolve().parents[1]
report=json.loads((root/'docs/reports/model-evaluation.json').read_text())
names=['seasonal-naive','moving-average','ridge','xgboost']
values=[]
for name in names:
    measured=[segment['candidates'][name]['test']['mae'] for segment in report['segments'].values() if 'test' in segment['candidates'].get(name,{})]
    values.append(sum(measured)/len(measured) if measured else 0)
fig,ax=plt.subplots(figsize=(10,5.5),facecolor='#0b1220')
ax.set_facecolor('#0b1220');bars=ax.bar(names,values,color=['#79ded2','#9b8ddd','#819ee0','#c6a3dc'],width=.6)
ax.set_ylabel('Mean held-out one-step MAE (synthetic units)',color='#c9d5e8')
ax.set_title('CityPulse synthetic benchmark\nEight geographic/category segments; no real-world accuracy claim',color='#e9edf6',loc='left',pad=22)
ax.tick_params(colors='#b1bfd4');ax.spines[['top','right']].set_visible(False)
for spine in ax.spines.values():spine.set_color('#3c4c64')
for bar,value in zip(bars,values):ax.text(bar.get_x()+bar.get_width()/2,value+.12,f'{value:.2f}',ha='center',color='#dce6f6')
ax.set_ylim(0,max(values)*1.24);fig.tight_layout();fig.savefig(root/'docs/assets/model-comparison.png',dpi=160);plt.close(fig)
print('Rendered actual synthetic benchmark chart')
