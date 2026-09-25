"""Game-ready Oinja actors. Original Oinja source is read-only. All outputs are local.
Blender authoring Z-up, facing +Y. GLB conversion is Y-up facing -Z.
"""
import bpy, math, json, random, hashlib
from pathlib import Path
from mathutils import Vector, Matrix
from math import sin, cos, pi
ROOT=Path('/Users/oliviapan/Desktop/Oinja-game')
SOURCE=ROOT/'art/source/characters/reference_highpoly.blend'
random.seed(41)
REPORT=[]
def clean():
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for a in list(bpy.data.actions):bpy.data.actions.remove(a)
    bpy.context.scene.unit_settings.system='METRIC';bpy.context.scene.render.fps=30

def color(hex):
    c=[int(hex[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4 for v in c)
def mat(name,h,metal=0,rough=.55,emission=0):
    m=bpy.data.materials.new(name);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color(h),1)
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    p.inputs['Emission Color'].default_value=(*color(h),1);p.inputs['Emission Strength'].default_value=emission
    m.diffuse_color=(*color(h),1);return m

def rig_create(specs,name):
    ar=bpy.data.armatures.new(name);ob=bpy.data.objects.new(name,ar);bpy.context.collection.objects.link(ob)
    bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    for bn,head,tail,parent in specs:
        b=ar.edit_bones.new(bn);b.head=head;b.tail=tail
        if parent:b.parent=ar.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT');ob.select_set(False)
    for p in ob.pose.bones:p.rotation_mode='XYZ'
    return ob

def bind(ob,arm,weights=None,bone='root'):
    if weights:
        for idx,groups in weights:
            for bn,w in groups:
                if w>.001:
                    g=ob.vertex_groups.get(bn) or ob.vertex_groups.new(name=bn);g.add([idx],w,'REPLACE')
    else:
        g=ob.vertex_groups.new(name=bone);g.add(list(range(len(ob.data.vertices))),1,'REPLACE')
    ob.parent=arm
    mod=ob.modifiers.new('Animation skin','ARMATURE');mod.object=arm

def action(arm,name,duration,posefun,samples=13):
    arm.animation_data_create();a=bpy.data.actions.new(name);arm.animation_data.action=a
    for i in range(samples):
        t=i/(samples-1);frame=1+round(t*duration*30)
        for b in arm.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
        posefun(arm,t)
        for b in arm.pose.bones:
            b.keyframe_insert('rotation_euler',frame=frame,group=b.name);b.keyframe_insert('location',frame=frame,group=b.name);b.keyframe_insert('scale',frame=frame,group=b.name)
    tr=arm.animation_data.nla_tracks.new();tr.name=name;st=tr.strips.new(name,1,a);st.action_frame_start=1;st.action_frame_end=1+round(duration*30)
    arm.animation_data.action=None
    return a

def rot(arm,bn,x=0,y=0,z=0):arm.pose.bones[bn].rotation_euler=(x,y,z)
def origin(ob):
    mw=ob.matrix_world.copy();ob.parent=None;ob.matrix_world=mw
    bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);ob.select_set(False)

def join_meshes(obs,name):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in obs:ob.select_set(True)
    bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();out=bpy.context.object;out.name=name;out.select_set(False);return out

def export(arm,name,kind):
    bpy.context.scene.frame_set(1)
    for tr in arm.animation_data.nla_tracks:tr.mute=True
    for b in arm.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
    src=ROOT/'art/source'/kind/(name+'.blend');out=ROOT/'public/assets'/kind/(name+'.glb')
    bpy.ops.wm.save_as_mainfile(filepath=str(src))
    for tr in arm.animation_data.nla_tracks:tr.mute=False
    bpy.ops.object.select_all(action='DESELECT');arm.select_set(True)
    meshes=[]
    for ob in bpy.context.scene.objects:
        if ob.type=='MESH' and ob.parent==arm:ob.select_set(True);meshes.append(ob)
    bpy.context.view_layer.objects.active=arm
    bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_nla_strips_merged_animation_name='Animation',export_apply=False,export_yup=True,export_skins=True,export_def_bones=True,export_extras=True)
    tris=sum(sum(len(p.vertices)-2 for p in ob.data.polygons) for ob in meshes)
    REPORT.append(dict(id=name,file=str(out.relative_to(ROOT)),bytes=out.stat().st_size,triangles=tris,bones=len(arm.data.bones),animations=[t.name for t in arm.animation_data.nla_tracks],sha256=hashlib.sha256(out.read_bytes()).hexdigest()))
    for tr in arm.animation_data.nla_tracks:tr.mute=True
    return arm

def stage(arm,name,height=2):
    sc=bpy.context.scene
    sc.render.engine='CYCLES';sc.cycles.samples=24;sc.cycles.use_denoising=True
    sc.render.resolution_x=800;sc.render.resolution_y=1000;sc.render.resolution_percentage=100
    sc.world.color=(.18,.18,.18)
    floor=mat('Review ground','181F2C',rough=.8)
    bpy.ops.mesh.primitive_plane_add(size=200);plane=bpy.context.object;plane.data.materials.append(floor);plane.location.z=-.012
    def light(loc,power,size):
        d=bpy.data.lights.new('Studio light','AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new('Studio light',d);sc.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,height*.5))-o.location).to_track_quat('-Z','Y').to_euler()
    light((3,4,6),650,5);light((-3,1,3),430,4);light((0,-4,4),850,3)
    d=bpy.data.cameras.new('Review camera');camera=bpy.data.objects.new('Review camera',d);sc.collection.objects.link(camera);sc.camera=camera;d.type='ORTHO';d.ortho_scale=height*1.3
    for view,loc in [('front',(height*1.8,height*3,height*1.05)),('back',(-height*1.8,-height*3,height*1.05))]:
        camera.location=loc;camera.rotation_euler=(Vector((0,0,height*.48))-camera.location).to_track_quat('-Z','Y').to_euler();sc.render.filepath=str(ROOT/'art/reviews'/(name+'_'+view+'.png'));bpy.ops.render.render(write_still=True)
    for o in list(sc.objects):
        if o.parent!=arm and o!=arm:bpy.data.objects.remove(o,do_unlink=True)

def hero():
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE));sc=bpy.context.scene
    bpy.ops.object.select_all(action='DESELECT')
    original=[o for o in sc.objects if o.type in {'MESH','CURVE'} and not any(c.name.startswith(('90','99')) for c in o.users_collection)]
    keep=set(original)
    for o in original:
        mw=o.matrix_world.copy();o.parent=None;o.matrix_world=mw
    for o in list(sc.objects):
        if o not in keep:bpy.data.objects.remove(o,do_unlink=True)
    groups={o.name:o.users_collection[0].name for o in original}
    for ob in original:
        for mod in list(ob.modifiers):
            if mod.type=='SUBSURF':ob.modifiers.remove(mod)
        if ob.type=='CURVE':ob.data.resolution_u=3;ob.data.bevel_resolution=1;ob.data.resolution_u=3
        bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.convert(target='MESH');ob.select_set(False)
        origin(ob)
        # Base geometry simplification preserves silhouette, eye apertures and small symbols.
        if len(ob.data.polygons)>45:
            dec=ob.modifiers.new('Game topology reduction','DECIMATE');dec.ratio=.23 if len(ob.data.polygons)>250 else .55
            if 'eye' in ob.name.lower() or 'heart' in ob.name.lower():dec.ratio=.55
            bpy.context.view_layer.objects.active=ob;bpy.ops.object.modifier_apply(modifier=dec.name)
    # World-space skinning of authored articulated parts, prior to coordinate conversion.
    specs=[('root',(0,0,0),(0,0,.15),None),('hips',(0,0,1.0),(0,0,1.16),'root'),('spine',(0,0,1.16),(0,0,1.39),'hips'),('chest',(0,0,1.39),(0,0,1.54),'spine'),('head',(0,0,1.54),(0,0,1.8),'chest')]
    for s,side in [(1,'L'),(-1,'R')]:
        specs += [(side+'_thigh',(s*.1,.018,1.01),(s*.13,-.008,.64),'hips'),(side+'_shin',(s*.13,-.008,.64),(s*.15,.012,.14),side+'_thigh'),(side+'_foot',(s*.15,.012,.14),(s*.15,-.13,.06),side+'_shin'),(side+'_upperarm',(s*.174,.020,1.47),(s*.233,.016,1.245),'chest'),(side+'_forearm',(s*.233,.016,1.245),(s*.275,.007,.97),side+'_upperarm'),(side+'_hand',(s*.275,.007,.97),(s*.28,-.01,.87),side+'_forearm')]
    arm=rig_create(specs,'OinjaRig');sc.render.fps=30
    for ob in original:
        grp=groups[ob.name];weights=[]
        for v in ob.data.vertices:
            x,y,z=v.co;side='L' if x>=0 else 'R'
            if grp.startswith(('02','03','04')):w=[('head',1)]
            elif grp.startswith(('06','07','08')):
                side='L' if grp.startswith(('06','07')) else 'R'
                if grp.startswith('08d') or z<.97:w=[(side+'_hand',1)]
                elif z<1.19:w=[(side+'_forearm',1)]
                elif z<1.30 and side=='L':
                    fac=max(0,min(1,(z-1.19)/.11));w=[(side+'_upperarm',fac),(side+'_forearm',1-fac)]
                elif z<1.25:w=[(side+'_forearm',1)]
                else:w=[(side+'_upperarm',1)]
            elif grp.startswith(('01','10','12','13')):
                if z<.17:w=[(side+'_foot',1)]
                elif z<.57:w=[(side+'_shin',1)]
                elif z<.71:
                    fac=(z-.57)/.14;w=[(side+'_thigh',fac),(side+'_shin',1-fac)]
                elif z>1.0:w=[('hips',1)]
                else:w=[(side+'_thigh',1)]
            elif grp.startswith('09'):w=[('hips',1)]
            elif grp.startswith(('11','14')):w=[('chest',1)]
            else:
                fac=max(0,min(1,(z-1.25)/.17));w=[('spine',1-fac),('chest',fac)]
            weights.append((v.index,w))
        bind(ob,arm,weights)
    # Collapse material overhead with per-corner vertex colors and four PBR groups.
    pm=[]
    for name,rough,metal,em in [('Cloth',.79,0,0),('Skin',.55,0,0),('SatinMetal',.36,.62,0),('Rune',.4,.1,.35)]:
        m=mat('Oinja_'+name,'FFFFFF',metal,rough,em);n=m.node_tree.nodes.new('ShaderNodeVertexColor');n.layer_name='Color';p=m.node_tree.nodes.get('Principled BSDF');m.node_tree.links.new(n.outputs['Color'],p.inputs['Base Color'])
        if em:m.node_tree.links.new(n.outputs['Color'],p.inputs['Emission Color'])
        pm.append(m)
    for ob in original:
        old=list(ob.data.materials);vc=ob.data.color_attributes.new(name='Color',type='BYTE_COLOR',domain='CORNER');cats=[]
        for p in ob.data.polygons:
            ma=old[min(p.material_index,len(old)-1)];bs=ma.node_tree.nodes.get('Principled BSDF');col=bs.inputs['Base Color'].default_value if bs else ma.diffuse_color
            cat=3 if any(t in ma.name.lower() for t in ['ink','inlay']) else 2 if bs and bs.inputs['Metallic'].default_value>.3 else 1 if any(t in ma.name.lower() for t in ['skin','eye','iris','pupil']) else 0
            cats.append(cat)
            for li in p.loop_indices:vc.data[li].color=col
        ob.data.materials.clear()
        for m in pm:ob.data.materials.append(m)
        for p,cat in zip(ob.data.polygons,cats):p.material_index=cat
    mesh=join_meshes(original,'Oinja_GameMesh')
    for mod in list(mesh.modifiers):mesh.modifiers.remove(mod)
    mod=mesh.modifiers.new('Oinja skin','ARMATURE');mod.object=arm;mesh.parent=arm
    # Rotate the entire rig so glTF +Y conversion yields forward -Z, wearer right +X.
    arm.rotation_euler.z=pi
    arm['source']='Approved Oinja v1.2 four views; adapted read-only component geometry; new skinning, topology, PBR packing and animation authored in Oinja-game.'
    arm['forward']='-Z after glTF export';arm['height_m']=1.86
    def idle(a,t):
        rot(a,'spine',.013*sin(t*2*pi));rot(a,'L_forearm',.06);rot(a,'R_forearm',.07)
    def run(a,t):
        v=sin(t*2*pi);rot(a,'hips',.06,0,.035*v);rot(a,'chest',-.05,0,-.07*v)
        for s,side in [(1,'L'),(-1,'R')]:
            rot(a,side+'_thigh',s*v*.68);rot(a,side+'_shin',-.2-max(0,-s*v)*.85);rot(a,side+'_foot',.12+max(0,-s*v)*.15)
            rot(a,side+'_upperarm',-s*v*.62,0,s*.05);rot(a,side+'_forearm',.65+max(0,s*v)*.25)
        a.pose.bones['root'].location.z=.025*(1-cos(t*4*pi))
    def ability(kind):
        def pose(a,t):
            f=sin(pi*min(1,t/.75)) if t<.75 else 0
            if kind=='death':
                rot(a,'root',-1.45*min(1,t*1.5));a.pose.bones['root'].location.z=-.06*min(1,t*2);rot(a,'L_thigh',.2);rot(a,'R_upperarm',-.5);return
            if kind=='victory':rot(a,'L_upperarm',2.5*sin(pi*t*.5),0,-.25);rot(a,'head',0,0,.15*sin(t*pi));return
            if kind=='hit':rot(a,'chest',-.25*f);return
            if kind in ['jump','land']:rot(a,'L_thigh',.6*f);rot(a,'R_thigh',.4*f);rot(a,'L_shin',-.9*f);rot(a,'R_shin',-.7*f);return
            right=kind in ['punch','heavy','shield','cannon','grapple']
            side='R' if right else 'L';amp=1.2 if right else 1.4
            rot(a,side+'_upperarm',amp*f,0,(-.18 if right else .25)*f);rot(a,side+'_forearm',(.25 if kind!='shield' else 1.25)*f)
            rot(a,'chest',.06*f,0,(-.20 if right else .22)*f);rot(a,'hips',0,0,(.1 if right else -.1)*f)
            if kind=='barrier':rot(a,'L_upperarm',2.1*f,0,.2*f);rot(a,'R_upperarm',.6*f)
            if kind=='mist':rot(a,'L_upperarm',.9*f,0,-.8*f);rot(a,'L_forearm',.45*f)
        return pose
    action(arm,'idle',2,idle);action(arm,'run',.7,run,17)
    action(arm,'walk',1,lambda a,t:run(a,t),17)
    for kind,du in [('punch',.45),('heavy',.65),('cast',.7),('shield',1.1),('cannon',.8),('grapple',.6),('mist',.8),('barrier',1.5),('death',1.4),('jump',.6),('land',.35),('hit',.3),('victory',2),('bubble',.4)]:action(arm,kind,du,ability(kind))
    export(arm,'oinja','characters');stage(arm,'oinja',1.90)

def primitive(name,loc,scale,ma,kind='box',bone='body',parts=None):
    if kind=='box':
        bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=scale
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);mod=o.modifiers.new('Machined chamfer','BEVEL');mod.width=min(scale)*.14;mod.segments=1;bpy.ops.object.modifier_apply(modifier=mod.name)
    elif kind=='sphere':
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=1,location=loc);o=bpy.context.object;o.scale=scale
    elif kind=='cylinder':
        bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=1,depth=1,location=loc);o=bpy.context.object;o.scale=scale
    elif kind=='torus':
        bpy.ops.mesh.primitive_torus_add(major_segments=24,minor_segments=6,major_radius=1,minor_radius=.12,location=loc);o=bpy.context.object;o.scale=scale
    o.name=name;o.data.materials.append(ma)
    for p in o.data.polygons:p.use_smooth=kind!='box'
    if parts is not None:parts.append((o,bone))
    return o

def strut(name,p1,p2,width,ma,bone,parts):
    a,b=Vector(p1),Vector(p2);o=primitive(name,(a+b)/2,(width,width,(b-a).length),ma,'cylinder',bone,parts);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o

def enemy(kind):
    clean();P=[];spec=[('root',(0,0,0),(0,0,.15),None),('body',(0,0,.6),(0,0,.9),'root')]
    dark=mat('Graphite chassis','263642',.7,.37);plate=mat('Weathered ochre armor','B97532',.63,.45);steel=mat('Machined silver','8C9CA1',.75,.32);hot=mat('Amber power lens','FF772B',.18,.25,2.2)
    def part(name,loc,scale,ma=plate,shape='box',bone='body'):return primitive(name,loc,scale,ma,shape,bone,P)
    def leg(idx,hip,knee,foot,thick=.06):
        bn='leg'+str(idx);sh='shin'+str(idx);spec.extend([(bn,hip,knee,'body'),(sh,knee,foot,bn)])
        strut('Hydraulic upper '+str(idx),hip,knee,thick,dark,bn,P);strut('Outer piston '+str(idx),hip,knee,thick*.52,plate,bn,P)
        part('Rotary knee '+str(idx),knee,(thick*1.5,)*3,steel,'sphere',bn)
        strut('Tapered lower '+str(idx),knee,foot,thick*.75,plate,sh,P);part('Ground pad '+str(idx),foot,(thick*2,thick*2.2,.07),dark,'box',sh)
    if kind=='crawler':
        part('Low shell',(0,0,.37),(.47,.58,.27));part('Inset power cell',(0,.03,.54),(.20,.28,.065),hot)
        part('Underbody',(0,0,.25),(.36,.42,.13),dark)
        for s in [-1,1]:
            part('Forward sensor',(s*.13,.29,.38),(.05,.035,.05),hot,'sphere')
            for j,y in enumerate([-.18,.19]):leg((s+1)*2+j,(s*.19,y,.36),(s*.43,y*.9,.25),(s*.53,y*1.55,.045),.037)
        for x in [-.15,.15]:part('Shell ridge',(x,-.04,.54),(.042,.36,.042),steel)
        h=.70
    elif kind=='rammer':
        part('Massive forward carapace',(0,.20,.88),(.7,.88,.61));part('Rear drive body',(0,-.36,.82),(.48,.42,.33),dark)
        part('Faceted forward brow',(0,.66,.94),(.68,.16,.29),steel)
        part('Hot visor',(0,.755,.93),(.38,.025,.075),hot)
        for s in [-1,1]:
            strut('Impact horn',(s*.22,.61,.88),(s*.26,1.05,.96),.07,steel,'body',P)
            leg(0 if s<0 else 1,(s*.24,.35,.80),(s*.38,.43,.47),(s*.40,.62,.08),.075)
            leg(2 if s<0 else 3,(s*.21,-.37,.76),(s*.37,-.65,.62),(s*.42,-.50,.07),.06)
            part('Side shock absorber',(s*.365,.05,.86),(.06,.44,.13),dark)
        for y in [-.13,.07,.27]:part('Dorsal armored plate',(0,y,1.20),(.40,.10,.065),plate)
        h=1.45
    elif kind=='gunner':
        part('Hover reactor',(0,0,1.2),(.24,.24,.30),dark,'sphere');part('Exposed reactor lens',(0,.23,1.2),(.14,.05,.14),hot,'sphere')
        part('Levitation ring',(0,0,1.1),(.49,.49,.45),steel,'torus')
        part('Lower levitation ring',(0,0,1.01),(.36,.36,.3),hot,'torus')
        for i in range(3):
            a=i*2*pi/3;cx,cy=sin(a)*.45,cos(a)*.45;bn='fin'+str(i);spec.append((bn,(cx,cy,1.10),(cx,cy,1.4),'body'))
            fin=part('Deployable cannon leaf '+str(i),(cx,cy,1.34),(.21,.12,.53),plate,'box',bn);fin.rotation_euler.z=-a
            barrel=part('Pulse needle barrel '+str(i),(cx,cy+.10,1.29),(.04,.04,.32),dark,'cylinder',bn);barrel.rotation_euler.x=pi/2
            part('Barrel glow '+str(i),(cx,cy+.25,1.29),(.04,.02,.04),hot,'sphere',bn)
        h=1.85
    elif kind=='bulwark':
        part('Heavy chassis',(0,0,.54),(1.22,.88,.42),dark);part('Main turret',(0,0,1.1),(.88,.7,.78))
        spec.append(('shield',(0,.4,.7),(0,.4,1.4),'body'))
        part('Main blast shield',(0,.55,1.03),(1.35,.19,1.23),plate,'box','shield')
        part('Shield vertical rib',(0,.665,1.03),(.17,.07,1.17),steel,'box','shield')
        for s in [-1,1]:
            side=part('Angled shield wing',(s*.53,.5,1.04),(.27,.19,1.19),dark,'box','shield');side.rotation_euler.z=s*.17
            part('Shield hazard slit',(s*.32,.662,1.28),(.28,.03,.055),hot,'box','shield')
            part('Drive track',(s*.65,-.04,.27),(.31,.99,.4),dark)
            for j,y in enumerate([-.32,0,.32]):
                bn='wheel'+str((s+1)*2+j);spec.append((bn,(s*.65,y,.27),(s*.8,y,.27),'root'))
                o=part('Track hub',(s*.83,y,.27),(.16,.16,.08),steel,'cylinder',bn);o.rotation_euler.y=pi/2
        part('Rear power core',(0,-.41,1.10),(.30,.15,.51),hot,'cylinder')
        for x in [-.23,.23]:part('Rear guard rails',(x,-.44,1.07),(.06,.06,.66),steel)
        h=1.9
    else:
        part('Cable drum',(0,0,1.70),(.32,.32,.50),dark,'cylinder');part('Spindle upper rim',(0,0,1.96),(.43,.43,.10),plate,'cylinder');part('Spindle lower rim',(0,0,1.43),(.43,.43,.10),plate,'cylinder')
        for z in [1.52,1.62,1.72,1.82,1.90]:part('Copper winding',(0,0,z),(.325,.325,.16),steel,'torus')
        part('Power spindle',(0,0,2.03),(.14,.14,.10),hot,'cylinder')
        for i in range(4):
            a=pi/4+i*pi/2;u,v=sin(a),cos(a);leg(i,(u*.28,v*.28,1.50),(u*.74,v*.74,1.14),(u*.91,v*.91,.045),.052)
        spec.append(('probe',(0,0,1.44),(0,0,.72),'body'));strut('Contact probe',(0,0,1.43),(0,0,.50),.038,steel,'probe',P);part('Probe emitter',(0,0,.48),(.09,.09,.10),hot,'sphere','probe')
        for s in [-1,1]:part('Optical sensor',(s*.16,.36,1.85),(.06,.04,.055),hot,'sphere')
        h=2.35
    arm=rig_create(spec,kind+'Rig')
    for ob,bn in P:origin(ob);bind(ob,arm,bone=bn)
    mesh=join_meshes([o for o,b in P],kind+'_GameMesh')
    for mo in list(mesh.modifiers):mesh.modifiers.remove(mo)
    mo=mesh.modifiers.new('Mechanical articulation','ARMATURE');mo.object=arm;mesh.parent=arm
    def idle(a,t):
        a.pose.bones['body'].location.z=.035*sin(t*2*pi) if kind=='gunner' else .008*sin(t*2*pi)
        rot(a,'body',0,0,.025*sin(t*2*pi))
    def move(a,t):
        idle(a,t)
        for b in a.pose.bones:
            if b.name.startswith('leg'):rot(a,b.name,.28*sin(t*2*pi+int(b.name[-1])*pi),0,.12*sin(t*2*pi+int(b.name[-1])*pi))
            elif b.name.startswith('shin'):rot(a,b.name,-.28*max(0,sin(t*2*pi+int(b.name[-1])*pi)))
            elif b.name.startswith('wheel'):rot(a,b.name,0,t*2*pi)
            elif b.name.startswith('fin'):rot(a,b.name,0,0,.09*sin(t*2*pi))
    def attack(a,t):
        f=sin(pi*t);rot(a,'body',-.18*f if kind=='rammer' else .1*f)
        for b in a.pose.bones:
            if b.name.startswith('fin'):rot(a,b.name,.6*f)
            if b.name=='shield':rot(a,b.name,-.2*f)
            if b.name=='probe':a.pose.bones[b.name].location.y=.35*f
            if b.name.startswith('leg'):rot(a,b.name,-.16*f)
    def death(a,t):
        f=min(1,t*1.5);a.pose.bones['body'].location.z=-.4*f;rot(a,'body',.35*f,.42*f)
        for b in a.pose.bones:
            if b.name.startswith('leg'):rot(a,b.name,.7*f,0,.3*f)
    action(arm,'idle',2,idle);action(arm,'move',.8,move,17);action(arm,'attack',.9,attack);action(arm,'windup',.7,attack);action(arm,'recover',.7,lambda a,t:attack(a,1-t));action(arm,'hit',.25,lambda a,t:rot(a,'body',.16*sin(t*pi)));action(arm,'death',1.1,death)
    arm['asset_role']='Original Oinja-game enemy; '+kind;arm['forward']='-Z glTF';export(arm,kind,'enemies');stage(arm,kind,h)

if __name__=='__main__':
    import sys
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    if not args or 'oinja' in args:hero()
    for k in ['crawler','rammer','gunner','bulwark','weaver']:
        if not args or k in args:enemy(k)
    (ROOT/'art/reviews/actors-production.json').write_text(json.dumps(REPORT,indent=2))
    print('ACTORS COMPLETE',json.dumps(REPORT))
