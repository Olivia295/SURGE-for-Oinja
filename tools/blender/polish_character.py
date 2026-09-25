"""Final targeted fixes: honey metal response and hidden chin cage under continuous mask."""
import bpy,sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent));import build_actors as B
for name in ['oinja','oinja_lod1']:
    bpy.ops.wm.open_mainfile(filepath=str(B.ROOT/'art/source/characters'/(name+'.blend')))
    arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH')
    metal=next(m for m in mesh.data.materials if m.name.startswith('Oinja_SatinMetal'))
    p=metal.node_tree.nodes.get('Principled BSDF');p.inputs['Metallic'].default_value=.32;p.inputs['Roughness'].default_value=.52
    skin_indices=set()
    for face in mesh.data.polygons:
        if mesh.data.materials[face.material_index].name.startswith('Oinja_Skin'):skin_indices.update(face.vertices)
    count=0
    for idx in skin_indices:
        v=mesh.data.vertices[idx]
        if 1.50*.985<v.co.z<1.658*.985 and abs(v.co.x)<.070*.985:
            v.co.x*=.8;v.co.y=.01+(v.co.y-.01)*.20;count+=1
    mesh.data.validate(clean_customdata=False);mesh.data.update()
    print(name,'hidden lower-face vertices retracted',count)
    B.export(arm,name,'characters')
    if name=='oinja':B.stage(arm,name,1.9)
(B.ROOT/'art/reviews/character-production.json').write_text(json.dumps(B.REPORT,indent=2))
