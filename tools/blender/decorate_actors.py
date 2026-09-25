import bpy,math,sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent));import build_actors as B
for kind in ['crawler','rammer','gunner','bulwark','weaver']:
    bpy.ops.wm.open_mainfile(filepath=str(B.ROOT/'art/source/enemies'/(kind+'.blend')))
    arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');base=next(o for o in bpy.context.scene.objects if o.type=='MESH');mats=list(base.data.materials)
    dark=next(m for m in mats if 'Graphite' in m.name);plate=next(m for m in mats if 'ochre' in m.name);steel=next(m for m in mats if 'silver' in m.name);hot=next(m for m in mats if 'Amber' in m.name)
    P=[]
    def part(n,l,s,ma=steel,b='body',shape='box'):return B.primitive(n,l,s,ma,shape,b,P)
    if kind=='crawler':
        for side in [-1,1]:
            for y in [-.14,-.05,.04,.13]:part('Cooling gills',(side*.24,y,.39),(.012,.034,.14),dark)
            for y in [-.22,.22]:part('Captured screw',(side*.18,y,.509),(.018,.018,.010),steel,shape='cylinder')
        part('Service cap',(0,-.27,.41),(.18,.02,.11),dark)
    if kind=='rammer':
        for side in [-1,1]:
            for y in [-.1,.02,.14,.26]:part('Armored flank vent',(side*.356,y,.94),(.012,.034,.13),dark)
            part('Welded jaw edge',(side*.28,.69,.80),(.055,.09,.24),plate)
            bpy.ops.mesh.primitive_cone_add(vertices=8,radius1=.075,radius2=.012,depth=.36,location=(side*.26,1.04,.98));o=bpy.context.object;o.name='Forged impact horn tip';o.rotation_euler.x=-math.pi/2;o.data.materials.append(steel);P.append((o,'body'))
            for y in [-.24,.20]:part('Flank captive bolt',(side*.356,y,.76),(.027,.027,.027),steel,shape='sphere')
        part('Spine separation',(0,-.01,1.226),(.04,.68,.025),dark)
    if kind=='gunner':
        for i in range(3):
            a=i*2*math.pi/3;x,y=math.sin(a)*.45,math.cos(a)*.45;b='fin'+str(i)
            for z in [1.23,1.34,1.45]:o=part('Cannon leaf heat slit',(x,y+.069,z),(.13,.012,.02),dark,b);o.rotation_euler.z=-a
            part('Leaf warning jewel',(x,y+.07,1.55),(.042,.014,.034),hot,b)
    if kind=='bulwark':
        for s in [-1,1]:
            for j in range(3):
                o=part('Diagonal warning inlay',(s*(.22+j*.1),.663,.57),(.055,.011,.25),dark,'shield');o.rotation_euler.y=-.5
            for z in [.53,1.02,1.48]:part('Recessed shield bolt',(s*.51,.659,z),(.036,.018,.036),steel,'shield',shape='sphere')
            for y in [-.43,-.30,-.17,-.04,.09,.22,.35]:part('Tread shoe',(s*.65,y,.466),(.33,.043,.037),plate,'root')
        for z in [.87,1.05,1.23]:part('Rear core guard',(0,-.50,z),(.51,.035,.035),dark)
    if kind=='weaver':
        for i in range(4):
            a=i*math.pi/2;u,v=math.sin(a),math.cos(a)
            B.strut('Spool retaining rod',(u*.36,v*.36,1.49),(u*.36,v*.36,1.93),.018,plate,'body',P)
        for i in range(8):
            a=i*math.pi/4;part('Spool cap bolt',(math.sin(a)*.32,math.cos(a)*.32,2.015),(.024,.024,.014),steel,shape='cylinder')
        part('Control module',(0,-.4,1.74),(.25,.12,.27),dark)
        for x in [-.07,0,.07]:part('Rear interface channel',(x,-.465,1.74),(.023,.015,.16),hot)
    for ob,bone in P:B.origin(ob);B.bind(ob,arm,bone=bone)
    mesh=B.join_meshes([base]+[o for o,b in P],kind+'_GameMesh')
    for m in list(mesh.modifiers):mesh.modifiers.remove(m)
    m=mesh.modifiers.new('Mechanical articulation','ARMATURE');m.object=arm;mesh.parent=arm
    B.export(arm,kind,'enemies');B.stage(arm,kind,2.45 if kind=='weaver' else 2 if kind in ['gunner','bulwark'] else 1.75 if kind=='rammer' else 1.18)
(B.ROOT/'art/reviews/enemies-production.json').write_text(json.dumps(B.REPORT,indent=2))
