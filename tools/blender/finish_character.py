import bpy,sys,math,json
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).parent));import build_actors as B
from math import sin,pi
bpy.ops.wm.open_mainfile(filepath=str(B.ROOT/'art/source/characters/oinja.blend'))
a=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH')
# Four independently hinged mechanical fingers enable visible fist closure.
bpy.context.view_layer.objects.active=a;a.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for i in range(4):
    x=(-.280-(i-1.5)*.0145)*.985;b=a.data.edit_bones.new('R_finger'+str(i));b.head=(x,.001,.897*.985);b.tail=(x,-.008,.847*.985);b.parent=a.data.edit_bones['R_hand']
bpy.ops.object.mode_set(mode='OBJECT')
hand=mesh.vertex_groups['R_hand'];new=[mesh.vertex_groups.new(name='R_finger'+str(i)) for i in range(4)]
for v in mesh.data.vertices:
    if v.co.z<.897*.985 and any(g.group==hand.index and g.weight>.5 for g in v.groups):
        i=min(range(4),key=lambda k:abs(v.co.x-(-.280-(k-1.5)*.0145)*.985))
        hand.remove([v.index]);new[i].add([v.index],1,'REPLACE')
for b in a.pose.bones:b.rotation_mode='XYZ'
for track in a.animation_data.nla_tracks:
    act=track.strips[0].action;a.animation_data.action=act
    frames=act.frame_range;count=13
    for i in range(count):
        t=i/(count-1);frame=frames[0]+(frames[1]-frames[0])*t
        f=sin(pi*min(1,t/.75)) if t<.75 else 0
        amount=1.48*f if track.name in ['punch','heavy'] else .25 if track.name in ['idle','run','walk'] else 0
        for k in range(4):
            bone=a.pose.bones['R_finger'+str(k)];bone.rotation_euler=(-amount,0,0);bone.keyframe_insert('rotation_euler',frame=frame,group=bone.name)
    a.animation_data.action=None
B.export(a,'oinja','characters')
for track in a.animation_data.nla_tracks:track.mute=track.name!='punch'
bpy.context.scene.frame_set(5);B.stage(a,'oinja_punch_final',1.9)
for track in a.animation_data.nla_tracks:track.mute=True
bpy.context.scene.frame_set(1)
# Lower detail actor shares the exact animation/skeleton contract.
bpy.context.view_layer.objects.active=mesh
dec=mesh.modifiers.new('LOD1 silhouette reduction','DECIMATE');dec.ratio=.30;dec.use_collapse_triangulate=True
bpy.ops.object.modifier_move_up(modifier=dec.name);bpy.ops.object.modifier_apply(modifier=dec.name)
B.export(a,'oinja_lod1','characters')
(B.ROOT/'art/reviews/character-production.json').write_text(json.dumps(B.REPORT,indent=2))
