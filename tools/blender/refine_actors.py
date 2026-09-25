import bpy,sys,math,json,struct,hashlib
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).parent))
import build_actors as B
ROOT=B.ROOT

def curves(action):
    if hasattr(action,'fcurves'):return action.fcurves
    return [fc for layer in action.layers for strip in layer.strips for bag in strip.channelbags for fc in bag.fcurves]

for kind in ['oinja','crawler','rammer','gunner','bulwark','weaver']:
    group='characters' if kind=='oinja' else 'enemies'
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/source'/group/(kind+'.blend')))
    arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH')
    if kind=='oinja':
        bpy.context.view_layer.objects.active=mesh
        dec=mesh.modifiers.new('Runtime reduction 35k target','DECIMATE');dec.ratio=.27;dec.use_collapse_triangulate=True
        # Apply before skin. The simplifier interpolates weights and vertex colors.
        bpy.ops.object.modifier_move_up(modifier=dec.name);bpy.ops.object.modifier_apply(modifier=dec.name)
    elif kind=='crawler':
        bpy.context.view_layer.objects.active=mesh;dec=mesh.modifiers.new('Swarm geometry budget','DECIMATE');dec.ratio=.56;dec.use_collapse_triangulate=True;bpy.ops.object.modifier_move_up(modifier=dec.name);bpy.ops.object.modifier_apply(modifier=dec.name)
    for action in bpy.data.actions:
        for fc in curves(action):
            if kind=='oinja' and 'rotation_euler' in fc.data_path and fc.array_index==0 and any(b in fc.data_path for b in ['_upperarm','_forearm','_thigh','_shin','_foot']):
                for k in fc.keyframe_points:k.co.y*=-1;k.handle_left.y*=-1;k.handle_right.y*=-1
            if 'location' in fc.data_path and fc.array_index==2 and any('"'+b+'"' in fc.data_path for b in ['root','body']):fc.array_index=1
    B.export(arm,kind,group)
    # Review the final exported topology and distinct action poses.
    if kind=='oinja':
        B.stage(arm,kind,1.9)
        for clip in ['run','punch','cast','barrier']:
            for track in arm.animation_data.nla_tracks:track.mute=track.name!=clip
            bpy.context.scene.frame_set(8)
            B.stage(arm,'oinja_'+clip,1.9)
            for track in arm.animation_data.nla_tracks:track.mute=True
            bpy.context.scene.frame_set(1)
        for b in arm.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0)
    else:B.stage(arm,kind,2.45 if kind=='weaver' else 2 if kind in ['gunner','bulwark'] else 1.75 if kind=='rammer' else 1.18)

# Articulated right-arm attachment pieces. +Y authoring axis exports to -Z.
for key in ['shield','cannon','grapple']:
    B.clean();parts=[]
    violet=B.mat('Violet satin shield','6B3A8F',.65,.32);skin=B.mat('Honey metal','D2A06A',.60,.38);dark=B.mat('Dark mechanism','151825',.7,.32);glow=B.mat('Purple circuit','B088ED',.15,.32,.6)
    def p(name,loc,scale,mat,kind='box'):return B.primitive(name,loc,scale,mat,kind,'tool',parts)
    if key=='shield':
        for rad,depth,ma in [(.46,.04,dark),(.435,.05,violet),(.14,.075,skin)]:
            o=p('Shield concentric armor',(0,.14,0),(rad,rad,depth),ma,'cylinder');o.rotation_euler.x=math.pi/2
        o=p('Circular rim',(0,.15,0),(.44,.44,.14),glow,'torus');o.rotation_euler.x=math.pi/2
        for i in range(8):
            a=i*math.pi/4;o=p('Folding shield petal seam',(math.sin(a)*.28,.176,math.cos(a)*.28),(.012,.012,.22),dark);o.rotation_euler.y=a
    elif key=='cannon':
        for y,r,l,ma in [(0,.09,.22,dark),(.20,.11,.36,skin),(.40,.13,.08,violet),(.45,.095,.02,glow)]:
            o=p('Accelerator barrel',(0,y,0),(r,r,l),ma,'cylinder');o.rotation_euler.x=math.pi/2
        for s in [-1,1]:p('Charge rail',(s*.09,.19,.03),(.025,.41,.028),glow)
        p('Rear power housing',(0,-.12,0),(.18,.15,.16),violet)
    else:
        o=p('Cable socket',(0,.03,0),(.065,.065,.10),skin,'cylinder');o.rotation_euler.x=math.pi/2
        for i in range(3):
            a=i*2*math.pi/3;c,s=math.cos(a),math.sin(a)
            B.strut('Three prong base',(c*.04,.02,s*.04),(c*.13,.16,s*.13),.022,skin,'tool',parts)
            B.strut('Three prong hook',(c*.13,.16,s*.13),(c*.065,.27,s*.065),.02,violet,'tool',parts)
        p('Anchor sensor',(0,.04,0),(.02,.02,.02),glow,'sphere')
    for ob,bn in parts:B.origin(ob)
    mesh=B.join_meshes([o for o,b in parts],key+'_attachment');mesh['attachBone']='R_hand';mesh['axis']='forward -Z in glTF; origin is wrist mount'
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/source/characters'/('tool_'+key+'.blend')))
    bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);bpy.context.view_layer.objects.active=mesh
    bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/assets/characters'/('tool_'+key+'.glb')),export_format='GLB',use_selection=True,export_yup=True,export_extras=True)
(ROOT/'art/reviews/actors-production.json').write_text(json.dumps(B.REPORT,indent=2))
print('REFINEMENT COMPLETE')
