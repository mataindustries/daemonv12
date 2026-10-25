"""Scoped RGB8 quantization comparison; source/settings validation stays mandatory."""
import numpy as np
from PIL import Image
SCOPED = {389, 418}

def compare(original, independent, frame):
    with Image.open(original) as a, Image.open(independent) as b:
        if a.size != (1080,1920) or b.size != a.size or a.mode != 'RGB' or b.mode != 'RGB':
            raise ValueError('Recheck requires native1080x1920 RGB images')
        x=np.asarray(a,dtype=np.int16);y=np.asarray(b,dtype=np.int16)
    delta=np.abs(x-y); maximum=int(delta.max());mean=float(delta.mean())
    # One RGB8 quantum, at most2% of channels. No geometric/brightness/noise
    # tolerance: differences of2+ levels always fail this scoped rounding rule.
    rounding=frame in SCOPED and maximum<=1 and mean<=0.02
    return {'frame':frame,'pixelIdentical':maximum==0,'maxAbsRgb8':maximum,
            'meanAbsRgb8':mean,'rmsRgb8':float(np.sqrt(np.mean(delta.astype(float)**2))),
            'changedChannelFraction':float((delta!=0).mean()),
            'changedPixelFraction':float(np.any(delta!=0,axis=2).mean()),
            'channelDifferenceCounts':{str(v):int((delta==v).sum()) for v in np.unique(delta)},
            'rule':'exact RGB8;389/418 only: max1LSB and mean<=0.02/255',
            'passed':maximum==0 or rounding}
