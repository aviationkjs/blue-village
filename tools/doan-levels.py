# Hand-placed coloring templates. Validated for overlaps / bounds / doors facing roads.
import json
FP = {'fountain':(2,2),'pond':(2,2),'bridge':(2,1),'playground':(3,2),'cottage':(3,2),'greenhouse':(2,2),'tower':(3,3),'storeBox':(2,2),'tripleGable':(3,2),'castle':(3,2)}
def c(h,t): return 100+h*16+t
R,R2,LR=c(0,6),c(0,10),c(0,3); PK,PK2=c(13,4),c(14,6); O,O2,LO=c(1,6),c(2,8),c(1,3); Y,Y2,LY=c(3,4),c(3,9),c(3,2)
LG,G,G2=c(4,5),c(5,7),c(5,11); T=c(6,7); SK,LSK=c(8,5),c(8,2); B,N=c(9,7),c(10,10); P,LP=c(11,7),c(11,3); BR,LBR=c(1,12),c(1,9); GY,LGY=c(15,7),c(15,3)

TPL=[]
def H(ref,x,z,rot,wall,roof,win=None): return ['house',str(ref),x,z,rot,wall,roof,win]
def M(ref,x,z,rot,wall,roof=None,win=None): return ['model',ref,x,z,rot,wall,roof,win]
def D(ref,x,z,wall=None,roof=None,rot=0): return ['deco',ref,x,z,rot,wall,roof,None]
def tree(x,z,leaf=G,trunk=BR,kind='tree'): return D(kind,x,z,trunk,leaf)
def seg(x1,z1,x2,z2): return [(x,z) for x in range(min(x1,x2),max(x1,x2)+1) for z in range(min(z1,z2),max(z1,z2)+1)]

# 1
TPL.append(('첫 마을', [H(0,9,10,0,R,B), H(4,13,10,0,Y,G)], seg(8,12,15,12), None))
# 2
TPL.append(('노란 지붕 셋', [H(1,7,10,0,PK,Y), H(12,11,10,0,SK,Y), H(15,15,10,0,LG,Y)], seg(6,12,17,12), None))
# 3
TPL.append(('나무 사이 집', [H(1,10,8,1,O,BR), H(12,10,13,1,SK,BR), H(15,13,10,3,PK,BR),
  tree(8,6), tree(15,7), tree(8,16), tree(15,15), tree(16,12,LG,BR,'roundTree')], seg(12,6,12,17), None))
# 4
TPL.append(('길 따라', [H(3,4,9,0,R,N), H(33,8,9,0,O,N), H(42,12,9,0,Y,N), H(49,16,9,0,G,N),
  tree(6,13,G), tree(10,13,G), tree(14,13,G), tree(18,13,G)], seg(3,11,20,11), GY))
# 5
ring = seg(9,9,14,9)+seg(9,14,14,14)+seg(9,10,9,13)+seg(14,10,14,13)
TPL.append(('작은 광장', [M('fountain',11,11,0,SK), H(2,11,7,0,Y,R), H(25,11,15,2,PK,B), H(9,7,11,1,PK,R), H(16,15,11,3,Y,B),
  D('bench',10,11,BR,R), D('bench',13,12,BR,R)], ring, LGY))
# 6
TPL.append(('연못 공원', [M('pond',9,9,0,GY,G), M('pond',11,10,0,GY,G), M('bridge',13,10,0,O2), D('bench',8,12,BR,G2), D('bench',12,13,BR,G2),
  tree(7,8,G), tree(16,8,LG), tree(7,13,G2), tree(16,13,G,BR,'roundTree'), D('bush',10,12,None,G2), D('bush',11,12,None,LG),
  tree(13,7,LG,BR,'roundTree'), tree(10,7,G)], [], None))
# 7
TPL.append(('빨간 마을', [H(13,6,8,0,R,GY), H(22,10,8,0,PK,N), H(24,14,8,0,R2,GY), H(27,6,12,1,PK2,N), H(29,14,12,3,LR,GY),
  tree(9,16,G), tree(12,16,G)], seg(5,10,18,10)+seg(10,11,13,11)+seg(8,11,8,15)+seg(13,12,13,15), GY))
# 8
TPL.append(('푸른 바닷가', [H(5,5,9,0,SK,N), H(26,9,9,0,LSK,B), H(28,13,9,0,T,N), H(32,17,9,0,B,LSK), M('storeBox',8,13,2,LSK,Y), M('storeBox',14,13,2,SK,Y),
  D('lamp',12,13), D('bench',11,13,LBR,SK)], seg(4,11,20,11), LSK))
# 9
TPL.append(('놀이터 동네', [M('playground',10,10,0,R,Y), H(3,6,6,0,Y,R), H(42,10,6,0,PK,B), H(43,14,6,0,SK,R), H(0,6,14,2,PK,B), H(12,14,14,2,Y,R),
  tree(8,11,G), tree(14,12,G,BR,'roundTree'), D('bench',9,12,BR,B)], seg(5,8,17,8)+seg(5,13,17,13)+seg(5,9,5,12)+seg(17,9,17,12), LGY))
# 10
TPL.append(('탑이 있는 마을', [M('tower',10,8,0,LGY,R), H(8,6,7,1,Y,R), H(11,16,8,3,SK,N), H(20,7,13,1,PK,R), H(31,15,13,3,LG,N),
  tree(9,16,G), tree(14,16,G)], seg(8,11,15,11)+seg(9,12,9,15)+seg(14,12,14,15)+seg(8,6,8,10)+seg(15,6,15,10), GY))
# 11
TPL.append(('온실 농장', [M('greenhouse',7,8,0,LG,G), M('storeBox',10,8,0,O,BR), M('cottage',14,8,0,LBR,R2),
  D('fence',6,12,BR), D('fence',7,12,BR), D('fence',8,12,BR), D('fence',9,12,BR), D('fence',10,12,BR),
  tree(6,15,G), tree(9,15,LG,BR,'roundTree'), tree(12,15,G), D('bush',15,12,None,G2), D('bush',17,12,None,LG)], seg(6,10,18,10)+seg(11,11,11,13), None))
# 12
TPL.append(('무지개 거리', [H(0,3,10,0,R,N), H(1,6,10,0,O,N), H(3,9,10,0,Y,N), H(4,12,10,0,G,N), H(12,15,10,0,SK,N), H(15,18,10,0,B,LGY), H(33,21,10,0,P,LGY)],
  seg(2,12,22,12), LGY))
# 13
TPL.append(('성 마을', [M('castle',10,6,0,LGY,P), D('fence',8,9,BR), D('fence',9,9,BR), D('fence',13,9,BR), D('fence',14,9,BR),
  H(14,6,12,0,Y,R), H(24,14,12,0,PK,R), H(40,8,15,2,PK,N), H(29,12,15,2,Y,N), tree(17,8,G), tree(6,8,G)], seg(11,8,11,14)+seg(5,14,17,14), Y2))
# 14
fl = [D('flowers',x,z,None,G) for x,z in [(7,8),(8,8),(15,8),(16,8),(7,14),(16,14),(11,15),(12,15)]]
TPL.append(('꽃 마을', [H(7,8,9,0,PK,P), H(30,13,9,0,LP,PK2), H(35,8,12,2,LR,PK2), H(38,13,12,2,PK,LP), D('bush',11,8,None,LG), D('bush',12,8,None,LG)] + fl,
  seg(7,11,16,11), LY))
# 15
TPL.append(('가을 마을', [H(13,6,9,0,LO,BR), H(14,10,9,0,Y,R2), H(22,14,9,0,O,BR), H(24,10,12,2,LBR,O2),
  tree(5,13,O), tree(7,14,R,BR,'roundTree'), tree(14,14,Y2), tree(16,13,O2,BR,'roundTree'), tree(18,9,R), tree(8,7,O), tree(13,7,Y2,BR,'roundTree'), tree(17,7,R)],
  seg(5,11,18,11), LBR))
# 16
TPL.append(('숲속 오두막', [M('cottage',10,10,0,LBR,G2), D('bench',12,13,BR,G),
  tree(7,8,G), tree(8,11,G2), tree(7,14,LG,BR,'roundTree'), tree(10,15,G), tree(13,15,G2,BR,'roundTree'), tree(15,13,G),
  tree(15,9,LG), tree(13,7,G,BR,'roundTree'), tree(10,7,G2), tree(16,11,G,BR,'roundTree'), D('bush',9,13,None,G), D('bush',14,12,None,LG)], seg(11,12,11,13)+seg(11,14,11,17), LBR))
# 17
TPL.append(('십자 거리', [H(0,8,8,0,R,GY), H(1,8,12,0,O,GY), H(3,13,8,0,Y,GY), H(4,13,12,0,G,GY),
  H(12,9,15,1,SK,N), H(15,12,15,3,B,N), H(33,9,5,1,P,N), H(42,12,5,3,PK,N)],
  seg(11,4,11,18)+seg(5,10,17,10)+seg(5,14,17,14), LGY))
# 18
TPL.append(('두 동네', [H(13,8,6,1,R,Y), H(14,8,10,1,O,Y), H(22,8,14,1,Y,R), tree(6,8,O), tree(6,12,R,BR,'roundTree'),
  H(26,13,6,3,SK,N), H(28,13,10,3,B,LSK), H(32,13,14,3,T,N), tree(17,8,SK,BR,'roundTree'), tree(17,12,T)], seg(10,4,12,17), GY))
# 19
TPL.append(('큰 공원', [M('fountain',11,10,0,LP), M('pond',6,6,0,GY,G), M('bridge',8,7,0,O2), M('playground',15,6,0,R,Y),
  D('bench',10,13,BR,G2), D('bench',13,13,BR,G2), D('lamp',9,10), D('lamp',14,10),
  tree(6,11,G), tree(6,14,LG,BR,'roundTree'), tree(17,11,G2), tree(17,14,G), D('bush',9,16,None,G), D('bush',14,16,None,LG), D('flowers',11,16,None,G), D('flowers',12,16,None,G)],
  seg(5,9,18,9)+seg(11,12,12,12), LY))
# 20
TPL.append(('무지개 큰 마을', [M('tripleGable',3,6,0,R,N), M('tower',7,5,0,O,R2), H(2,11,7,0,Y,N), H(8,14,7,0,LG,N), H(11,17,7,0,G,N), M('castle',4,12,2,SK,B),
  H(20,8,10,2,B,LSK), H(25,11,10,2,P,PK), H(31,14,10,2,PK,P), M('fountain',18,13,0,LP),
  tree(20,7,G), tree(20,16,LG,BR,'roundTree'), tree(3,16,G2), D('bench',17,16,BR,R)],
  seg(2,9,21,9)+seg(2,10,2,11)+seg(17,10,17,11), LGY))

def fp(kind,ref,rot):
    w,d = (2,2) if kind=='house' else FP.get(ref,(2,2)) if kind=='model' else (1,1)
    return (d,w) if rot%2 else (w,d)
out=[]
for li,(name,items,roads,rc) in enumerate(TPL):
    occ={}
    def take(cells,label):
        for cell in cells:
            x,z=cell
            assert 0<=x<24 and 0<=z<24, (name,label,cell)
            assert cell not in occ, (li+1,name,label,'overlaps',occ[cell],cell)
            occ[cell]=label
    roads=sorted(set(roads))
    for r in roads: take([r],'road')
    js=[]
    for it in items:
        kind,ref,x,z,rot,wall,roof,win=it
        w,d=fp(kind,ref,rot)
        take([(a,b) for a in range(x,x+w) for b in range(z,z+d)], f'{kind}:{ref}@{x},{z}')
        o={'k':kind,'r':ref,'x':x,'z':z,'rot':rot}
        if wall is not None: o['w']=wall
        if roof is not None: o['s']=roof
        if win is not None: o['n']=win
        js.append(o)
        # door check for houses/models with roads
        if roads and kind=='house':
            cx,cz=x+w//2,z+d//2
            front={0:(cx,z+d),1:(x+w,cz),2:(cx,z-1),3:(x-1,cz)}[rot]
            if front not in set(roads): print('  note: door not on road', li+1, name, ref, (x,z), front)
    out.append({'name':name,'items':js,'roads':[list(r) for r in sorted(set(roads))],'road':rc})
    cols=set()
    for o in js:
        for k in ('w','s','n'):
            if k in o: cols.add(o[k])
    if rc: cols.add(rc)
    print(li+1, name, 'items',len(js),'roads',len(set(roads)),'colors',len(cols))
open('/home/claude/gen/doan.json','w').write(json.dumps(out,ensure_ascii=False,separators=(',',':')))
