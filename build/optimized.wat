(module
 (type $0 (func (param i32) (result i32)))
 (type $1 (func))
 (type $2 (func (param i32 i32) (result i32)))
 (type $3 (func (param i32) (result f32)))
 (type $4 (func (param i32)))
 (type $5 (func (result i32)))
 (type $6 (func (param i32 f32 f32)))
 (type $7 (func (param i32 i32)))
 (type $8 (func (param i32 i32 i32)))
 (type $9 (func (param f32 f32 f32 i32) (result i32)))
 (type $10 (func (param i32 i32 i32 i32)))
 (type $11 (func (param i32 i32 i64)))
 (type $12 (func (param i32 i32 i32) (result i32)))
 (type $13 (func (param f32 f32 f32 f32 i32) (result i32)))
 (type $14 (func (param i32 f64) (result i32)))
 (type $15 (func (param i32 i32) (result f64)))
 (type $16 (func (param f32 f32 i32 f32 f32) (result f32)))
 (type $17 (func (param f32 f32 f32 i32 f32 f32) (result f32)))
 (type $18 (func (param f32 f32) (result f32)))
 (type $19 (func (param f32 f32 f32) (result f32)))
 (import "env" "abort" (func $~lib/builtins/abort (param i32 i32 i32 i32)))
 (global $~lib/rt/itcms/total (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/threshold (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/state (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/visitCount (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/pinSpace (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/iter (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/toSpace (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/white (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/fromSpace (mut i32) (i32.const 0))
 (global $~lib/rt/tlsf/ROOT (mut i32) (i32.const 0))
 (global $assembly/noise/perm (mut i32) (i32.const 0))
 (global $assembly/noise/perm12 (mut i32) (i32.const 0))
 (global $assembly/physics/bodiesPtr (mut i32) (i32.const 0))
 (global $assembly/physics/bodiesCapacity (mut i32) (i32.const 0))
 (global $assembly/index/objectsPtr (mut i32) (i32.const 0))
 (global $assembly/index/objectsCapacity (mut i32) (i32.const 0))
 (global $assembly/index/asteroidsPtr (mut i32) (i32.const 0))
 (global $assembly/index/asteroidsCapacity (mut i32) (i32.const 0))
 (global $assembly/index/sporeCloudsPtr (mut i32) (i32.const 0))
 (global $assembly/index/sporeCloudsCapacity (mut i32) (i32.const 0))
 (global $assembly/index/bossHitboxPtr (mut i32) (i32.const 0))
 (global $assembly/index/bossHitboxCapacity (mut i32) (i32.const 0))
 (global $assembly/index/choreValuesPtr (mut i32) (i32.const 0))
 (global $assembly/index/choreValuesCapacity (mut i32) (i32.const 0))
 (global $assembly/index/choreIndicesPtr (mut i32) (i32.const 0))
 (global $assembly/index/choreIndicesCapacity (mut i32) (i32.const 0))
 (global $~lib/memory/__stack_pointer (mut i32) (i32.const 35580))
 (memory $0 2)
 (data $0 (i32.const 1036) "\1c\04")
 (data $0.1 (i32.const 1048) "\04\00\00\00\00\04\00\00\97\00\00\00\a0\00\00\00\89\00\00\00[\00\00\00Z\00\00\00\0f\00\00\00\83\00\00\00\r\00\00\00\c9\00\00\00_\00\00\00`\00\00\005\00\00\00\c2\00\00\00\e9\00\00\00\07\00\00\00\e1\00\00\00\8c\00\00\00$\00\00\00g\00\00\00\1e\00\00\00E\00\00\00\8e\00\00\00\08\00\00\00c\00\00\00%\00\00\00\f0\00\00\00\15\00\00\00\n\00\00\00\17\00\00\00\be\00\00\00\06\00\00\00\94\00\00\00\f7\00\00\00x\00\00\00\ea\00\00\00K\00\00\00\00\00\00\00\1a\00\00\00\c5\00\00\00>\00\00\00^\00\00\00\fc\00\00\00\db\00\00\00\cb\00\00\00u\00\00\00#\00\00\00\0b\00\00\00 \00\00\009\00\00\00\b1\00\00\00!\00\00\00X\00\00\00\ed\00\00\00\95\00\00\008\00\00\00W\00\00\00\ae\00\00\00\14\00\00\00}\00\00\00\88\00\00\00\ab\00\00\00\a8\00\00\00D\00\00\00\af\00\00\00J\00\00\00\a5\00\00\00G\00\00\00\86\00\00\00\8b\00\00\000\00\00\00\1b\00\00\00\a6\00\00\00M\00\00\00\92\00\00\00\9e\00\00\00\e7\00\00\00S\00\00\00o\00\00\00\e5\00\00\00z\00\00\00<\00\00\00\d3\00\00\00\85\00\00\00\e6\00\00\00\dc\00\00\00i\00\00\00\\\00\00\00)\00\00\007\00\00\00.\00\00\00\f5\00\00\00(\00\00\00\f4\00\00\00f\00\00\00\8f\00\00\006\00\00\00A\00\00\00\19\00\00\00?\00\00\00\a1\00\00\00\01\00\00\00\d8\00\00\00P\00\00\00I\00\00\00\d1\00\00\00L\00\00\00\84\00\00\00\bb\00\00\00\d0\00\00\00Y\00\00\00\12\00\00\00\a9\00\00\00\c8\00\00\00\c4\00\00\00\87\00\00\00\82\00\00\00t\00\00\00\bc\00\00\00\9f\00\00\00V\00\00\00\a4\00\00\00d\00\00\00m\00\00\00\c6\00\00\00\ad\00\00\00\ba\00\00\00\03\00\00\00@\00\00\004\00\00\00\d9\00\00\00\e2\00\00\00\fa\00\00\00|\00\00\00{\00\00\00\05\00\00\00\ca\00\00\00&\00\00\00\93\00\00\00v\00\00\00~\00\00\00\ff\00\00\00R\00\00\00U\00\00\00\d4\00\00\00\cf\00\00\00\ce\00\00\00;\00\00\00\e3\00\00\00/\00\00\00\10\00\00\00:\00\00\00\11\00\00\00\b6\00\00\00\bd\00\00\00\1c\00\00\00*\00\00\00\df\00\00\00\b7\00\00\00\aa\00\00\00\d5\00\00\00w\00\00\00\f8\00\00\00\98\00\00\00\02\00\00\00,\00\00\00\9a\00\00\00\a3\00\00\00F\00\00\00\dd\00\00\00\99\00\00\00e\00\00\00\9b\00\00\00\a7\00\00\00+\00\00\00\ac\00\00\00\t\00\00\00\81\00\00\00\16\00\00\00\'\00\00\00\fd\00\00\00\13\00\00\00b\00\00\00l\00\00\00n\00\00\00O\00\00\00q\00\00\00\e0\00\00\00\e8\00\00\00\b2\00\00\00\b9\00\00\00p\00\00\00h\00\00\00\da\00\00\00\f6\00\00\00a\00\00\00\e4\00\00\00\fb\00\00\00\"\00\00\00\f2\00\00\00\c1\00\00\00\ee\00\00\00\d2\00\00\00\90\00\00\00\0c\00\00\00\bf\00\00\00\b3\00\00\00\a2\00\00\00\f1\00\00\00Q\00\00\003\00\00\00\91\00\00\00\eb\00\00\00\f9\00\00\00\0e\00\00\00\ef\00\00\00k\00\00\001\00\00\00\c0\00\00\00\d6\00\00\00\1f\00\00\00\b5\00\00\00\c7\00\00\00j\00\00\00\9d\00\00\00\b8\00\00\00T\00\00\00\cc\00\00\00\b0\00\00\00s\00\00\00y\00\00\002\00\00\00-\00\00\00\7f\00\00\00\04\00\00\00\96\00\00\00\fe\00\00\00\8a\00\00\00\ec\00\00\00\cd\00\00\00]\00\00\00\de\00\00\00r\00\00\00C\00\00\00\1d\00\00\00\18\00\00\00H\00\00\00\f3\00\00\00\8d\00\00\00\80\00\00\00\c3\00\00\00N\00\00\00B\00\00\00\d7\00\00\00=\00\00\00\9c\00\00\00\b4")
 (data $1 (i32.const 2092) "\ac")
 (data $1.1 (i32.const 2104) "\05\00\00\00\90\00\00\00\00\00\80?\00\00\80?\00\00\00\00\00\00\80\bf\00\00\80?\00\00\00\00\00\00\80?\00\00\80\bf\00\00\00\00\00\00\80\bf\00\00\80\bf\00\00\00\00\00\00\80?\00\00\00\00\00\00\80?\00\00\80\bf\00\00\00\00\00\00\80?\00\00\80?\00\00\00\00\00\00\80\bf\00\00\80\bf\00\00\00\00\00\00\80\bf\00\00\00\00\00\00\80?\00\00\80?\00\00\00\00\00\00\80\bf\00\00\80?\00\00\00\00\00\00\80?\00\00\80\bf\00\00\00\00\00\00\80\bf\00\00\80\bf")
 (data $2 (i32.const 2268) ",")
 (data $2.1 (i32.const 2280) "\02\00\00\00\1c\00\00\00I\00n\00v\00a\00l\00i\00d\00 \00l\00e\00n\00g\00t\00h")
 (data $3 (i32.const 2316) "<")
 (data $3.1 (i32.const 2328) "\02\00\00\00&\00\00\00~\00l\00i\00b\00/\00s\00t\00a\00t\00i\00c\00a\00r\00r\00a\00y\00.\00t\00s")
 (data $4 (i32.const 2380) "<")
 (data $4.1 (i32.const 2392) "\02\00\00\00(\00\00\00A\00l\00l\00o\00c\00a\00t\00i\00o\00n\00 \00t\00o\00o\00 \00l\00a\00r\00g\00e")
 (data $5 (i32.const 2444) "<")
 (data $5.1 (i32.const 2456) "\02\00\00\00 \00\00\00~\00l\00i\00b\00/\00r\00t\00/\00i\00t\00c\00m\00s\00.\00t\00s")
 (data $8 (i32.const 2572) "<")
 (data $8.1 (i32.const 2584) "\02\00\00\00$\00\00\00I\00n\00d\00e\00x\00 \00o\00u\00t\00 \00o\00f\00 \00r\00a\00n\00g\00e")
 (data $9 (i32.const 2636) ",")
 (data $9.1 (i32.const 2648) "\02\00\00\00\14\00\00\00~\00l\00i\00b\00/\00r\00t\00.\00t\00s")
 (data $11 (i32.const 2716) "<")
 (data $11.1 (i32.const 2728) "\02\00\00\00\1e\00\00\00~\00l\00i\00b\00/\00r\00t\00/\00t\00l\00s\00f\00.\00t\00s")
 (data $12 (i32.const 2784) "\06\00\00\00 \00\00\00 \00\00\00 \00\00\00\00\00\00\00$\t\00\00$\19")
 (export "allocObjects" (func $assembly/index/allocObjects))
 (export "freeObjects" (func $assembly/index/freeObjects))
 (export "getObjectPtr" (func $assembly/index/getObjectPtr))
 (export "allocAsteroids" (func $assembly/index/allocAsteroids))
 (export "allocSporeClouds" (func $assembly/index/allocSporeClouds))
 (export "checkCollision" (func $assembly/index/checkCollision))
 (export "checkSporeCollision" (func $assembly/index/checkSporeCollision))
 (export "allocBossHitboxes" (func $assembly/index/allocBossHitboxes))
 (export "checkBossCollision" (func $assembly/index/checkBossCollision))
 (export "allocChoreValues" (func $assembly/index/allocChoreValues))
 (export "allocChoreIndices" (func $assembly/index/allocChoreIndices))
 (export "choresCompact" (func $assembly/index/choresCompact))
 (export "choresReduce" (func $assembly/index/choresReduce))
 (export "simplexNoise2D" (func $assembly/noise/simplexNoise2D))
 (export "simplexNoise3D" (func $assembly/noise/simplexNoise3D))
 (export "fractalNoise2D" (func $assembly/noise/fractalNoise2D))
 (export "fractalNoise3D" (func $assembly/noise/fractalNoise3D))
 (export "allocPhysicsBodies" (func $assembly/physics/allocPhysicsBodies))
 (export "stepPhysics" (func $assembly/physics/stepPhysics))
 (export "getBodyPositionX" (func $assembly/physics/getBodyPositionX))
 (export "getBodyPositionY" (func $assembly/physics/getBodyPositionY))
 (export "setBodyPosition" (func $assembly/physics/setBodyPosition))
 (export "addBodyAcceleration" (func $assembly/physics/addBodyAcceleration))
 (export "getBodyRadius" (func $assembly/physics/getBodyRadius))
 (export "memory" (memory $0))
 (start $~start)
 (func $~lib/rt/itcms/visitRoots
  (local $0 i32)
  (local $1 i32)
  i32.const 2592
  call $~lib/rt/itcms/__visit
  i32.const 2288
  call $~lib/rt/itcms/__visit
  i32.const 2400
  call $~lib/rt/itcms/__visit
  i32.const 1056
  call $~lib/rt/itcms/__visit
  i32.const 2112
  call $~lib/rt/itcms/__visit
  global.get $assembly/noise/perm
  local.tee $0
  if
   local.get $0
   call $~lib/rt/itcms/__visit
  end
  global.get $assembly/noise/perm12
  local.tee $0
  if
   local.get $0
   call $~lib/rt/itcms/__visit
  end
  global.get $~lib/rt/itcms/pinSpace
  local.tee $1
  i32.load offset=4
  i32.const -4
  i32.and
  local.set $0
  loop $while-continue|0
   local.get $0
   local.get $1
   i32.ne
   if
    local.get $0
    i32.load offset=4
    i32.const 3
    i32.and
    i32.const 3
    i32.ne
    if
     i32.const 0
     i32.const 2464
     i32.const 160
     i32.const 16
     call $~lib/builtins/abort
     unreachable
    end
    local.get $0
    i32.const 20
    i32.add
    call $~lib/rt/__visit_members
    local.get $0
    i32.load offset=4
    i32.const -4
    i32.and
    local.set $0
    br $while-continue|0
   end
  end
 )
 (func $~lib/rt/itcms/__visit (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  local.get $0
  i32.eqz
  if
   return
  end
  global.get $~lib/rt/itcms/white
  local.get $0
  i32.const 20
  i32.sub
  local.tee $1
  i32.load offset=4
  i32.const 3
  i32.and
  i32.eq
  if
   local.get $1
   global.get $~lib/rt/itcms/iter
   i32.eq
   if
    local.get $1
    i32.load offset=8
    local.tee $0
    i32.eqz
    if
     i32.const 0
     i32.const 2464
     i32.const 148
     i32.const 30
     call $~lib/builtins/abort
     unreachable
    end
    local.get $0
    global.set $~lib/rt/itcms/iter
   end
   block $__inlined_func$~lib/rt/itcms/Object#unlink$123
    local.get $1
    i32.load offset=4
    i32.const -4
    i32.and
    local.tee $0
    i32.eqz
    if
     local.get $1
     i32.load offset=8
     i32.eqz
     local.get $1
     i32.const 35580
     i32.lt_u
     i32.and
     i32.eqz
     if
      i32.const 0
      i32.const 2464
      i32.const 128
      i32.const 18
      call $~lib/builtins/abort
      unreachable
     end
     br $__inlined_func$~lib/rt/itcms/Object#unlink$123
    end
    local.get $1
    i32.load offset=8
    local.tee $2
    i32.eqz
    if
     i32.const 0
     i32.const 2464
     i32.const 132
     i32.const 16
     call $~lib/builtins/abort
     unreachable
    end
    local.get $0
    local.get $2
    i32.store offset=8
    local.get $2
    local.get $0
    local.get $2
    i32.load offset=4
    i32.const 3
    i32.and
    i32.or
    i32.store offset=4
   end
   global.get $~lib/rt/itcms/toSpace
   local.set $2
   local.get $1
   i32.load offset=12
   local.tee $0
   i32.const 2
   i32.le_u
   if (result i32)
    i32.const 1
   else
    local.get $0
    i32.const 2784
    i32.load
    i32.gt_u
    if
     i32.const 2592
     i32.const 2656
     i32.const 21
     i32.const 28
     call $~lib/builtins/abort
     unreachable
    end
    local.get $0
    i32.const 2
    i32.shl
    i32.const 2788
    i32.add
    i32.load
    i32.const 32
    i32.and
   end
   local.set $3
   local.get $2
   i32.load offset=8
   local.set $0
   local.get $1
   global.get $~lib/rt/itcms/white
   i32.eqz
   i32.const 2
   local.get $3
   select
   local.get $2
   i32.or
   i32.store offset=4
   local.get $1
   local.get $0
   i32.store offset=8
   local.get $0
   local.get $1
   local.get $0
   i32.load offset=4
   i32.const 3
   i32.and
   i32.or
   i32.store offset=4
   local.get $2
   local.get $1
   i32.store offset=8
   global.get $~lib/rt/itcms/visitCount
   i32.const 1
   i32.add
   global.set $~lib/rt/itcms/visitCount
  end
 )
 (func $~lib/rt/tlsf/removeBlock (param $0 i32) (param $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  local.get $1
  i32.load
  local.tee $3
  i32.const 1
  i32.and
  i32.eqz
  if
   i32.const 0
   i32.const 2736
   i32.const 268
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $3
  i32.const -4
  i32.and
  local.tee $3
  i32.const 12
  i32.lt_u
  if
   i32.const 0
   i32.const 2736
   i32.const 270
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $3
  i32.const 256
  i32.lt_u
  if (result i32)
   local.get $3
   i32.const 4
   i32.shr_u
  else
   i32.const 31
   i32.const 1073741820
   local.get $3
   local.get $3
   i32.const 1073741820
   i32.ge_u
   select
   local.tee $3
   i32.clz
   i32.sub
   local.tee $4
   i32.const 7
   i32.sub
   local.set $2
   local.get $3
   local.get $4
   i32.const 4
   i32.sub
   i32.shr_u
   i32.const 16
   i32.xor
  end
  local.tee $3
  i32.const 16
  i32.lt_u
  local.get $2
  i32.const 23
  i32.lt_u
  i32.and
  i32.eqz
  if
   i32.const 0
   i32.const 2736
   i32.const 284
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  i32.load offset=8
  local.set $5
  local.get $1
  i32.load offset=4
  local.tee $4
  if
   local.get $4
   local.get $5
   i32.store offset=8
  end
  local.get $5
  if
   local.get $5
   local.get $4
   i32.store offset=4
  end
  local.get $1
  local.get $0
  local.get $2
  i32.const 4
  i32.shl
  local.get $3
  i32.add
  i32.const 2
  i32.shl
  i32.add
  local.tee $1
  i32.load offset=96
  i32.eq
  if
   local.get $1
   local.get $5
   i32.store offset=96
   local.get $5
   i32.eqz
   if
    local.get $0
    local.get $2
    i32.const 2
    i32.shl
    i32.add
    local.tee $1
    i32.load offset=4
    i32.const -2
    local.get $3
    i32.rotl
    i32.and
    local.set $3
    local.get $1
    local.get $3
    i32.store offset=4
    local.get $3
    i32.eqz
    if
     local.get $0
     local.get $0
     i32.load
     i32.const -2
     local.get $2
     i32.rotl
     i32.and
     i32.store
    end
   end
  end
 )
 (func $~lib/rt/tlsf/insertBlock (param $0 i32) (param $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  local.get $1
  i32.eqz
  if
   i32.const 0
   i32.const 2736
   i32.const 201
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  i32.load
  local.tee $3
  i32.const 1
  i32.and
  i32.eqz
  if
   i32.const 0
   i32.const 2736
   i32.const 203
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  i32.const 4
  i32.add
  local.get $1
  i32.load
  i32.const -4
  i32.and
  i32.add
  local.tee $4
  i32.load
  local.tee $2
  i32.const 1
  i32.and
  if
   local.get $0
   local.get $4
   call $~lib/rt/tlsf/removeBlock
   local.get $1
   local.get $3
   i32.const 4
   i32.add
   local.get $2
   i32.const -4
   i32.and
   i32.add
   local.tee $3
   i32.store
   local.get $1
   i32.const 4
   i32.add
   local.get $1
   i32.load
   i32.const -4
   i32.and
   i32.add
   local.tee $4
   i32.load
   local.set $2
  end
  local.get $3
  i32.const 2
  i32.and
  if
   local.get $1
   i32.const 4
   i32.sub
   i32.load
   local.tee $1
   i32.load
   local.tee $6
   i32.const 1
   i32.and
   i32.eqz
   if
    i32.const 0
    i32.const 2736
    i32.const 221
    i32.const 16
    call $~lib/builtins/abort
    unreachable
   end
   local.get $0
   local.get $1
   call $~lib/rt/tlsf/removeBlock
   local.get $1
   local.get $6
   i32.const 4
   i32.add
   local.get $3
   i32.const -4
   i32.and
   i32.add
   local.tee $3
   i32.store
  end
  local.get $4
  local.get $2
  i32.const 2
  i32.or
  i32.store
  local.get $3
  i32.const -4
  i32.and
  local.tee $2
  i32.const 12
  i32.lt_u
  if
   i32.const 0
   i32.const 2736
   i32.const 233
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $4
  local.get $1
  i32.const 4
  i32.add
  local.get $2
  i32.add
  i32.ne
  if
   i32.const 0
   i32.const 2736
   i32.const 234
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $4
  i32.const 4
  i32.sub
  local.get $1
  i32.store
  local.get $2
  i32.const 256
  i32.lt_u
  if (result i32)
   local.get $2
   i32.const 4
   i32.shr_u
  else
   i32.const 31
   i32.const 1073741820
   local.get $2
   local.get $2
   i32.const 1073741820
   i32.ge_u
   select
   local.tee $2
   i32.clz
   i32.sub
   local.tee $3
   i32.const 7
   i32.sub
   local.set $5
   local.get $2
   local.get $3
   i32.const 4
   i32.sub
   i32.shr_u
   i32.const 16
   i32.xor
  end
  local.tee $2
  i32.const 16
  i32.lt_u
  local.get $5
  i32.const 23
  i32.lt_u
  i32.and
  i32.eqz
  if
   i32.const 0
   i32.const 2736
   i32.const 251
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  local.get $5
  i32.const 4
  i32.shl
  local.get $2
  i32.add
  i32.const 2
  i32.shl
  i32.add
  i32.load offset=96
  local.set $3
  local.get $1
  i32.const 0
  i32.store offset=4
  local.get $1
  local.get $3
  i32.store offset=8
  local.get $3
  if
   local.get $3
   local.get $1
   i32.store offset=4
  end
  local.get $0
  local.get $5
  i32.const 4
  i32.shl
  local.get $2
  i32.add
  i32.const 2
  i32.shl
  i32.add
  local.get $1
  i32.store offset=96
  local.get $0
  local.get $0
  i32.load
  i32.const 1
  local.get $5
  i32.shl
  i32.or
  i32.store
  local.get $0
  local.get $5
  i32.const 2
  i32.shl
  i32.add
  local.tee $0
  local.get $0
  i32.load offset=4
  i32.const 1
  local.get $2
  i32.shl
  i32.or
  i32.store offset=4
 )
 (func $~lib/rt/tlsf/addMemory (param $0 i32) (param $1 i32) (param $2 i64)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  local.get $2
  local.get $1
  i64.extend_i32_u
  i64.lt_u
  if
   i32.const 0
   i32.const 2736
   i32.const 382
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  i32.const 19
  i32.add
  i32.const -16
  i32.and
  i32.const 4
  i32.sub
  local.set $1
  local.get $0
  i32.load offset=1568
  local.tee $3
  if
   local.get $3
   i32.const 4
   i32.add
   local.get $1
   i32.gt_u
   if
    i32.const 0
    i32.const 2736
    i32.const 389
    i32.const 16
    call $~lib/builtins/abort
    unreachable
   end
   local.get $3
   local.get $1
   i32.const 16
   i32.sub
   local.tee $5
   i32.eq
   if
    local.get $3
    i32.load
    local.set $4
    local.get $5
    local.set $1
   end
  else
   local.get $0
   i32.const 1572
   i32.add
   local.get $1
   i32.gt_u
   if
    i32.const 0
    i32.const 2736
    i32.const 402
    i32.const 5
    call $~lib/builtins/abort
    unreachable
   end
  end
  local.get $2
  i32.wrap_i64
  i32.const -16
  i32.and
  local.get $1
  i32.sub
  local.tee $3
  i32.const 20
  i32.lt_u
  if
   return
  end
  local.get $1
  local.get $4
  i32.const 2
  i32.and
  local.get $3
  i32.const 8
  i32.sub
  local.tee $3
  i32.const 1
  i32.or
  i32.or
  i32.store
  local.get $1
  i32.const 0
  i32.store offset=4
  local.get $1
  i32.const 0
  i32.store offset=8
  local.get $1
  i32.const 4
  i32.add
  local.get $3
  i32.add
  local.tee $3
  i32.const 2
  i32.store
  local.get $0
  local.get $3
  i32.store offset=1568
  local.get $0
  local.get $1
  call $~lib/rt/tlsf/insertBlock
 )
 (func $~lib/rt/tlsf/initialize
  (local $0 i32)
  (local $1 i32)
  memory.size
  local.tee $1
  i32.const 0
  i32.le_s
  if (result i32)
   i32.const 1
   local.get $1
   i32.sub
   memory.grow
   i32.const 0
   i32.lt_s
  else
   i32.const 0
  end
  if
   unreachable
  end
  i32.const 35584
  i32.const 0
  i32.store
  i32.const 37152
  i32.const 0
  i32.store
  loop $for-loop|0
   local.get $0
   i32.const 23
   i32.lt_u
   if
    local.get $0
    i32.const 2
    i32.shl
    i32.const 35584
    i32.add
    i32.const 0
    i32.store offset=4
    i32.const 0
    local.set $1
    loop $for-loop|1
     local.get $1
     i32.const 16
     i32.lt_u
     if
      local.get $0
      i32.const 4
      i32.shl
      local.get $1
      i32.add
      i32.const 2
      i32.shl
      i32.const 35584
      i32.add
      i32.const 0
      i32.store offset=96
      local.get $1
      i32.const 1
      i32.add
      local.set $1
      br $for-loop|1
     end
    end
    local.get $0
    i32.const 1
    i32.add
    local.set $0
    br $for-loop|0
   end
  end
  i32.const 35584
  i32.const 37156
  memory.size
  i64.extend_i32_s
  i64.const 16
  i64.shl
  call $~lib/rt/tlsf/addMemory
  i32.const 35584
  global.set $~lib/rt/tlsf/ROOT
 )
 (func $~lib/rt/tlsf/checkUsedBlock (param $0 i32) (result i32)
  (local $1 i32)
  local.get $0
  i32.const 4
  i32.sub
  local.set $1
  local.get $0
  i32.const 15
  i32.and
  i32.const 1
  local.get $0
  select
  if (result i32)
   i32.const 1
  else
   local.get $1
   i32.load
   i32.const 1
   i32.and
  end
  if
   i32.const 0
   i32.const 2736
   i32.const 562
   i32.const 3
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
 )
 (func $~lib/rt/tlsf/__free (param $0 i32)
  (local $1 i32)
  local.get $0
  i32.const 35580
  i32.lt_u
  if
   return
  end
  global.get $~lib/rt/tlsf/ROOT
  i32.eqz
  if
   call $~lib/rt/tlsf/initialize
  end
  global.get $~lib/rt/tlsf/ROOT
  local.set $1
  local.get $0
  call $~lib/rt/tlsf/checkUsedBlock
  local.tee $0
  local.get $0
  i32.load
  i32.const 1
  i32.or
  i32.store
  local.get $1
  local.get $0
  call $~lib/rt/tlsf/insertBlock
 )
 (func $~lib/rt/itcms/step (result i32)
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  block $break|0
   block $case2|0
    block $case1|0
     block $case0|0
      global.get $~lib/rt/itcms/state
      br_table $case0|0 $case1|0 $case2|0 $break|0
     end
     i32.const 1
     global.set $~lib/rt/itcms/state
     i32.const 0
     global.set $~lib/rt/itcms/visitCount
     call $~lib/rt/itcms/visitRoots
     global.get $~lib/rt/itcms/toSpace
     global.set $~lib/rt/itcms/iter
     global.get $~lib/rt/itcms/visitCount
     return
    end
    global.get $~lib/rt/itcms/white
    i32.eqz
    local.set $1
    global.get $~lib/rt/itcms/iter
    i32.load offset=4
    i32.const -4
    i32.and
    local.set $0
    loop $while-continue|1
     local.get $0
     global.get $~lib/rt/itcms/toSpace
     i32.ne
     if
      local.get $0
      global.set $~lib/rt/itcms/iter
      local.get $1
      local.get $0
      i32.load offset=4
      local.tee $2
      i32.const 3
      i32.and
      i32.ne
      if
       local.get $0
       local.get $2
       i32.const -4
       i32.and
       local.get $1
       i32.or
       i32.store offset=4
       i32.const 0
       global.set $~lib/rt/itcms/visitCount
       local.get $0
       i32.const 20
       i32.add
       call $~lib/rt/__visit_members
       global.get $~lib/rt/itcms/visitCount
       return
      end
      local.get $0
      i32.load offset=4
      i32.const -4
      i32.and
      local.set $0
      br $while-continue|1
     end
    end
    i32.const 0
    global.set $~lib/rt/itcms/visitCount
    call $~lib/rt/itcms/visitRoots
    global.get $~lib/rt/itcms/toSpace
    global.get $~lib/rt/itcms/iter
    i32.load offset=4
    i32.const -4
    i32.and
    i32.eq
    if
     global.get $~lib/memory/__stack_pointer
     local.set $0
     loop $while-continue|0
      local.get $0
      i32.const 35580
      i32.lt_u
      if
       local.get $0
       i32.load
       call $~lib/rt/itcms/__visit
       local.get $0
       i32.const 4
       i32.add
       local.set $0
       br $while-continue|0
      end
     end
     global.get $~lib/rt/itcms/iter
     i32.load offset=4
     i32.const -4
     i32.and
     local.set $0
     loop $while-continue|2
      local.get $0
      global.get $~lib/rt/itcms/toSpace
      i32.ne
      if
       local.get $1
       local.get $0
       i32.load offset=4
       local.tee $2
       i32.const 3
       i32.and
       i32.ne
       if
        local.get $0
        local.get $2
        i32.const -4
        i32.and
        local.get $1
        i32.or
        i32.store offset=4
        local.get $0
        i32.const 20
        i32.add
        call $~lib/rt/__visit_members
       end
       local.get $0
       i32.load offset=4
       i32.const -4
       i32.and
       local.set $0
       br $while-continue|2
      end
     end
     global.get $~lib/rt/itcms/fromSpace
     local.set $0
     global.get $~lib/rt/itcms/toSpace
     global.set $~lib/rt/itcms/fromSpace
     local.get $0
     global.set $~lib/rt/itcms/toSpace
     local.get $1
     global.set $~lib/rt/itcms/white
     local.get $0
     i32.load offset=4
     i32.const -4
     i32.and
     global.set $~lib/rt/itcms/iter
     i32.const 2
     global.set $~lib/rt/itcms/state
    end
    global.get $~lib/rt/itcms/visitCount
    return
   end
   global.get $~lib/rt/itcms/iter
   local.tee $0
   global.get $~lib/rt/itcms/toSpace
   i32.ne
   if
    local.get $0
    i32.load offset=4
    local.tee $1
    i32.const -4
    i32.and
    global.set $~lib/rt/itcms/iter
    global.get $~lib/rt/itcms/white
    i32.eqz
    local.get $1
    i32.const 3
    i32.and
    i32.ne
    if
     i32.const 0
     i32.const 2464
     i32.const 229
     i32.const 20
     call $~lib/builtins/abort
     unreachable
    end
    local.get $0
    i32.const 35580
    i32.lt_u
    if
     local.get $0
     i32.const 0
     i32.store offset=4
     local.get $0
     i32.const 0
     i32.store offset=8
    else
     global.get $~lib/rt/itcms/total
     local.get $0
     i32.load
     i32.const -4
     i32.and
     i32.const 4
     i32.add
     i32.sub
     global.set $~lib/rt/itcms/total
     local.get $0
     i32.const 4
     i32.add
     call $~lib/rt/tlsf/__free
    end
    i32.const 10
    return
   end
   global.get $~lib/rt/itcms/toSpace
   global.get $~lib/rt/itcms/toSpace
   i32.store offset=4
   global.get $~lib/rt/itcms/toSpace
   global.get $~lib/rt/itcms/toSpace
   i32.store offset=8
   i32.const 0
   global.set $~lib/rt/itcms/state
  end
  i32.const 0
 )
 (func $~lib/rt/tlsf/prepareSize (param $0 i32) (result i32)
  local.get $0
  i32.const 1073741820
  i32.gt_u
  if
   i32.const 2400
   i32.const 2736
   i32.const 461
   i32.const 29
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.const 12
  i32.le_u
  if (result i32)
   i32.const 12
  else
   local.get $0
   i32.const 19
   i32.add
   i32.const -16
   i32.and
   i32.const 4
   i32.sub
  end
 )
 (func $~lib/rt/tlsf/searchBlock (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  local.get $1
  i32.const 256
  i32.lt_u
  if
   local.get $1
   i32.const 4
   i32.shr_u
   local.set $1
  else
   local.get $1
   i32.const 536870910
   i32.lt_u
   if
    local.get $1
    i32.const 1
    i32.const 27
    local.get $1
    i32.clz
    i32.sub
    i32.shl
    i32.add
    i32.const 1
    i32.sub
    local.set $1
   end
   local.get $1
   i32.const 31
   local.get $1
   i32.clz
   i32.sub
   local.tee $2
   i32.const 4
   i32.sub
   i32.shr_u
   i32.const 16
   i32.xor
   local.set $1
   local.get $2
   i32.const 7
   i32.sub
   local.set $2
  end
  local.get $1
  i32.const 16
  i32.lt_u
  local.get $2
  i32.const 23
  i32.lt_u
  i32.and
  i32.eqz
  if
   i32.const 0
   i32.const 2736
   i32.const 334
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  local.get $2
  i32.const 2
  i32.shl
  i32.add
  i32.load offset=4
  i32.const -1
  local.get $1
  i32.shl
  i32.and
  local.tee $1
  if (result i32)
   local.get $0
   local.get $1
   i32.ctz
   local.get $2
   i32.const 4
   i32.shl
   i32.add
   i32.const 2
   i32.shl
   i32.add
   i32.load offset=96
  else
   local.get $0
   i32.load
   i32.const -1
   local.get $2
   i32.const 1
   i32.add
   i32.shl
   i32.and
   local.tee $1
   if (result i32)
    local.get $0
    local.get $1
    i32.ctz
    local.tee $1
    i32.const 2
    i32.shl
    i32.add
    i32.load offset=4
    local.tee $2
    i32.eqz
    if
     i32.const 0
     i32.const 2736
     i32.const 347
     i32.const 18
     call $~lib/builtins/abort
     unreachable
    end
    local.get $0
    local.get $2
    i32.ctz
    local.get $1
    i32.const 4
    i32.shl
    i32.add
    i32.const 2
    i32.shl
    i32.add
    i32.load offset=96
   else
    i32.const 0
   end
  end
 )
 (func $~lib/rt/tlsf/prepareBlock (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i32)
  (local $4 i32)
  local.get $1
  i32.load
  local.set $3
  local.get $2
  i32.const 4
  i32.add
  i32.const 15
  i32.and
  if
   i32.const 0
   i32.const 2736
   i32.const 361
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $3
  i32.const -4
  i32.and
  local.get $2
  i32.sub
  local.tee $4
  i32.const 16
  i32.ge_u
  if
   local.get $1
   local.get $2
   local.get $3
   i32.const 2
   i32.and
   i32.or
   i32.store
   local.get $1
   i32.const 4
   i32.add
   local.get $2
   i32.add
   local.tee $1
   local.get $4
   i32.const 4
   i32.sub
   i32.const 1
   i32.or
   i32.store
   local.get $0
   local.get $1
   call $~lib/rt/tlsf/insertBlock
  else
   local.get $1
   local.get $3
   i32.const -2
   i32.and
   i32.store
   local.get $1
   i32.const 4
   i32.add
   local.get $1
   i32.load
   i32.const -4
   i32.and
   i32.add
   local.tee $0
   local.get $0
   i32.load
   i32.const -3
   i32.and
   i32.store
  end
 )
 (func $~lib/rt/tlsf/allocateBlock (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local $3 i32)
  local.get $0
  local.get $1
  call $~lib/rt/tlsf/prepareSize
  local.tee $2
  call $~lib/rt/tlsf/searchBlock
  local.tee $1
  i32.eqz
  if
   memory.size
   local.tee $3
   local.get $2
   i32.const 256
   i32.ge_u
   if (result i32)
    local.get $2
    i32.const 536870910
    i32.lt_u
    if (result i32)
     local.get $2
     i32.const 1
     i32.const 27
     local.get $2
     i32.clz
     i32.sub
     i32.shl
     i32.add
     i32.const 1
     i32.sub
    else
     local.get $2
    end
   else
    local.get $2
   end
   i32.const 4
   local.get $0
   i32.load offset=1568
   local.get $3
   i32.const 16
   i32.shl
   i32.const 4
   i32.sub
   i32.ne
   i32.shl
   i32.add
   i32.const 65535
   i32.add
   i32.const -65536
   i32.and
   i32.const 16
   i32.shr_u
   local.tee $1
   local.get $1
   local.get $3
   i32.lt_s
   select
   memory.grow
   i32.const 0
   i32.lt_s
   if
    local.get $1
    memory.grow
    i32.const 0
    i32.lt_s
    if
     unreachable
    end
   end
   local.get $0
   local.get $3
   i32.const 16
   i32.shl
   memory.size
   i64.extend_i32_s
   i64.const 16
   i64.shl
   call $~lib/rt/tlsf/addMemory
   local.get $0
   local.get $2
   call $~lib/rt/tlsf/searchBlock
   local.tee $1
   i32.eqz
   if
    i32.const 0
    i32.const 2736
    i32.const 499
    i32.const 16
    call $~lib/builtins/abort
    unreachable
   end
  end
  local.get $2
  local.get $1
  i32.load
  i32.const -4
  i32.and
  i32.gt_u
  if
   i32.const 0
   i32.const 2736
   i32.const 501
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  local.get $1
  call $~lib/rt/tlsf/removeBlock
  local.get $0
  local.get $1
  local.get $2
  call $~lib/rt/tlsf/prepareBlock
  local.get $1
 )
 (func $~lib/rt/tlsf/moveBlock (param $0 i32) (param $1 i32) (param $2 i32) (result i32)
  local.get $0
  local.get $2
  call $~lib/rt/tlsf/allocateBlock
  local.tee $2
  i32.const 4
  i32.add
  local.get $1
  i32.const 4
  i32.add
  local.get $1
  i32.load
  i32.const -4
  i32.and
  memory.copy
  local.get $1
  i32.const 35580
  i32.ge_u
  if
   local.get $1
   local.get $1
   i32.load
   i32.const 1
   i32.or
   i32.store
   local.get $0
   local.get $1
   call $~lib/rt/tlsf/insertBlock
  end
  local.get $2
 )
 (func $~lib/memory/heap.realloc (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  global.get $~lib/rt/tlsf/ROOT
  i32.eqz
  if
   call $~lib/rt/tlsf/initialize
  end
  local.get $0
  i32.const 35580
  i32.lt_u
  if
   global.get $~lib/rt/tlsf/ROOT
   local.get $0
   call $~lib/rt/tlsf/checkUsedBlock
   local.get $1
   call $~lib/rt/tlsf/moveBlock
   local.set $0
  else
   block $__inlined_func$~lib/rt/tlsf/reallocateBlock$118
    global.get $~lib/rt/tlsf/ROOT
    local.set $2
    local.get $0
    call $~lib/rt/tlsf/checkUsedBlock
    local.set $0
    local.get $1
    call $~lib/rt/tlsf/prepareSize
    local.tee $3
    local.get $0
    i32.load
    local.tee $4
    i32.const -4
    i32.and
    local.tee $6
    i32.le_u
    if
     local.get $2
     local.get $0
     local.get $3
     call $~lib/rt/tlsf/prepareBlock
     br $__inlined_func$~lib/rt/tlsf/reallocateBlock$118
    end
    local.get $0
    i32.const 4
    i32.add
    local.get $0
    i32.load
    i32.const -4
    i32.and
    i32.add
    local.tee $5
    i32.load
    local.tee $7
    i32.const 1
    i32.and
    if
     local.get $6
     i32.const 4
     i32.add
     local.get $7
     i32.const -4
     i32.and
     i32.add
     local.tee $6
     local.get $3
     i32.ge_u
     if
      local.get $2
      local.get $5
      call $~lib/rt/tlsf/removeBlock
      local.get $0
      local.get $4
      i32.const 3
      i32.and
      local.get $6
      i32.or
      i32.store
      local.get $2
      local.get $0
      local.get $3
      call $~lib/rt/tlsf/prepareBlock
      br $__inlined_func$~lib/rt/tlsf/reallocateBlock$118
     end
    end
    local.get $2
    local.get $0
    local.get $1
    call $~lib/rt/tlsf/moveBlock
    local.set $0
   end
  end
  local.get $0
  i32.const 4
  i32.add
 )
 (func $assembly/index/allocObjects (param $0 i32) (result i32)
  (local $1 i32)
  local.get $0
  global.get $assembly/index/objectsCapacity
  i32.gt_s
  if
   local.get $0
   i32.const 4
   i32.shl
   local.set $1
   global.get $assembly/index/objectsCapacity
   if (result i32)
    global.get $assembly/index/objectsPtr
    local.get $1
    call $~lib/memory/heap.realloc
   else
    global.get $~lib/rt/tlsf/ROOT
    i32.eqz
    if
     call $~lib/rt/tlsf/initialize
    end
    global.get $~lib/rt/tlsf/ROOT
    local.get $1
    call $~lib/rt/tlsf/allocateBlock
    i32.const 4
    i32.add
   end
   global.set $assembly/index/objectsPtr
   local.get $0
   global.set $assembly/index/objectsCapacity
  end
  global.get $assembly/index/objectsPtr
 )
 (func $assembly/index/freeObjects
  global.get $assembly/index/objectsPtr
  if
   global.get $assembly/index/objectsPtr
   call $~lib/rt/tlsf/__free
   i32.const 0
   global.set $assembly/index/objectsPtr
   i32.const 0
   global.set $assembly/index/objectsCapacity
  end
 )
 (func $assembly/index/getObjectPtr (result i32)
  global.get $assembly/index/objectsPtr
 )
 (func $assembly/index/allocAsteroids (param $0 i32) (result i32)
  (local $1 i32)
  local.get $0
  global.get $assembly/index/asteroidsCapacity
  i32.gt_s
  if
   local.get $0
   i32.const 12
   i32.mul
   local.set $1
   global.get $assembly/index/asteroidsCapacity
   if (result i32)
    global.get $assembly/index/asteroidsPtr
    local.get $1
    call $~lib/memory/heap.realloc
   else
    global.get $~lib/rt/tlsf/ROOT
    i32.eqz
    if
     call $~lib/rt/tlsf/initialize
    end
    global.get $~lib/rt/tlsf/ROOT
    local.get $1
    call $~lib/rt/tlsf/allocateBlock
    i32.const 4
    i32.add
   end
   global.set $assembly/index/asteroidsPtr
   local.get $0
   global.set $assembly/index/asteroidsCapacity
  end
  global.get $assembly/index/asteroidsPtr
 )
 (func $assembly/index/allocSporeClouds (param $0 i32) (result i32)
  (local $1 i32)
  local.get $0
  global.get $assembly/index/sporeCloudsCapacity
  i32.gt_s
  if
   local.get $0
   i32.const 4
   i32.shl
   local.set $1
   global.get $assembly/index/sporeCloudsCapacity
   if (result i32)
    global.get $assembly/index/sporeCloudsPtr
    local.get $1
    call $~lib/memory/heap.realloc
   else
    global.get $~lib/rt/tlsf/ROOT
    i32.eqz
    if
     call $~lib/rt/tlsf/initialize
    end
    global.get $~lib/rt/tlsf/ROOT
    local.get $1
    call $~lib/rt/tlsf/allocateBlock
    i32.const 4
    i32.add
   end
   global.set $assembly/index/sporeCloudsPtr
   local.get $0
   global.set $assembly/index/sporeCloudsCapacity
  end
  global.get $assembly/index/sporeCloudsPtr
 )
 (func $assembly/index/checkCollision (param $0 f32) (param $1 f32) (param $2 f32) (param $3 i32) (result i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 f32)
  global.get $assembly/index/asteroidsPtr
  i32.eqz
  local.get $3
  i32.eqz
  i32.or
  if
   i32.const -1
   return
  end
  global.get $assembly/index/asteroidsPtr
  local.set $4
  loop $for-loop|0
   local.get $3
   local.get $5
   i32.gt_s
   if
    local.get $0
    local.get $4
    f32.load
    f32.sub
    local.tee $6
    local.get $6
    f32.mul
    local.get $1
    local.get $4
    f32.load offset=4
    f32.sub
    local.tee $6
    local.get $6
    f32.mul
    f32.add
    local.get $2
    local.get $4
    f32.load offset=8
    f32.add
    local.tee $6
    local.get $6
    f32.mul
    f32.lt
    if
     local.get $5
     return
    end
    local.get $4
    i32.const 12
    i32.add
    local.set $4
    local.get $5
    i32.const 1
    i32.add
    local.set $5
    br $for-loop|0
   end
  end
  i32.const -1
 )
 (func $assembly/index/checkSporeCollision (param $0 f32) (param $1 f32) (param $2 f32) (param $3 f32) (param $4 i32) (result i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 f32)
  global.get $assembly/index/sporeCloudsPtr
  i32.eqz
  local.get $4
  i32.eqz
  i32.or
  if
   i32.const -1
   return
  end
  global.get $assembly/index/sporeCloudsPtr
  local.set $5
  loop $for-loop|0
   local.get $4
   local.get $6
   i32.gt_s
   if
    local.get $0
    local.get $5
    f32.load
    f32.sub
    local.tee $7
    local.get $7
    f32.mul
    local.get $1
    local.get $5
    f32.load offset=4
    f32.sub
    local.tee $7
    local.get $7
    f32.mul
    f32.add
    local.get $2
    local.get $5
    f32.load offset=8
    f32.sub
    local.tee $7
    local.get $7
    f32.mul
    f32.add
    local.get $3
    local.get $5
    f32.load offset=12
    f32.add
    local.tee $7
    local.get $7
    f32.mul
    f32.lt
    if
     local.get $6
     return
    end
    local.get $5
    i32.const 16
    i32.add
    local.set $5
    local.get $6
    i32.const 1
    i32.add
    local.set $6
    br $for-loop|0
   end
  end
  i32.const -1
 )
 (func $assembly/index/allocBossHitboxes (param $0 i32) (result i32)
  (local $1 i32)
  local.get $0
  global.get $assembly/index/bossHitboxCapacity
  i32.gt_s
  if
   local.get $0
   i32.const 12
   i32.mul
   local.set $1
   global.get $assembly/index/bossHitboxCapacity
   if (result i32)
    global.get $assembly/index/bossHitboxPtr
    local.get $1
    call $~lib/memory/heap.realloc
   else
    global.get $~lib/rt/tlsf/ROOT
    i32.eqz
    if
     call $~lib/rt/tlsf/initialize
    end
    global.get $~lib/rt/tlsf/ROOT
    local.get $1
    call $~lib/rt/tlsf/allocateBlock
    i32.const 4
    i32.add
   end
   global.set $assembly/index/bossHitboxPtr
   local.get $0
   global.set $assembly/index/bossHitboxCapacity
  end
  global.get $assembly/index/bossHitboxPtr
 )
 (func $assembly/index/checkBossCollision (param $0 f32) (param $1 f32) (param $2 f32) (param $3 i32) (result i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 f32)
  global.get $assembly/index/bossHitboxPtr
  i32.eqz
  local.get $3
  i32.eqz
  i32.or
  if
   i32.const -1
   return
  end
  global.get $assembly/index/bossHitboxPtr
  local.set $4
  loop $for-loop|0
   local.get $3
   local.get $5
   i32.gt_s
   if
    local.get $0
    local.get $4
    f32.load
    f32.sub
    local.tee $6
    local.get $6
    f32.mul
    local.get $1
    local.get $4
    f32.load offset=4
    f32.sub
    local.tee $6
    local.get $6
    f32.mul
    f32.add
    local.get $2
    local.get $4
    f32.load offset=8
    f32.add
    local.tee $6
    local.get $6
    f32.mul
    f32.lt
    if
     local.get $5
     return
    end
    local.get $4
    i32.const 12
    i32.add
    local.set $4
    local.get $5
    i32.const 1
    i32.add
    local.set $5
    br $for-loop|0
   end
  end
  i32.const -1
 )
 (func $assembly/index/allocChoreValues (param $0 i32) (result i32)
  (local $1 i32)
  local.get $0
  global.get $assembly/index/choreValuesCapacity
  i32.gt_s
  if
   local.get $0
   i32.const 2
   i32.shl
   local.set $1
   global.get $assembly/index/choreValuesCapacity
   if (result i32)
    global.get $assembly/index/choreValuesPtr
    local.get $1
    call $~lib/memory/heap.realloc
   else
    global.get $~lib/rt/tlsf/ROOT
    i32.eqz
    if
     call $~lib/rt/tlsf/initialize
    end
    global.get $~lib/rt/tlsf/ROOT
    local.get $1
    call $~lib/rt/tlsf/allocateBlock
    i32.const 4
    i32.add
   end
   global.set $assembly/index/choreValuesPtr
   local.get $0
   global.set $assembly/index/choreValuesCapacity
  end
  global.get $assembly/index/choreValuesPtr
 )
 (func $assembly/index/allocChoreIndices (param $0 i32) (result i32)
  (local $1 i32)
  local.get $0
  global.get $assembly/index/choreIndicesCapacity
  i32.gt_s
  if
   local.get $0
   i32.const 2
   i32.shl
   local.set $1
   global.get $assembly/index/choreIndicesCapacity
   if (result i32)
    global.get $assembly/index/choreIndicesPtr
    local.get $1
    call $~lib/memory/heap.realloc
   else
    global.get $~lib/rt/tlsf/ROOT
    i32.eqz
    if
     call $~lib/rt/tlsf/initialize
    end
    global.get $~lib/rt/tlsf/ROOT
    local.get $1
    call $~lib/rt/tlsf/allocateBlock
    i32.const 4
    i32.add
   end
   global.set $assembly/index/choreIndicesPtr
   local.get $0
   global.set $assembly/index/choreIndicesCapacity
  end
  global.get $assembly/index/choreIndicesPtr
 )
 (func $assembly/index/choresCompact (param $0 i32) (param $1 f64) (result i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  global.get $assembly/index/choreIndicesPtr
  i32.eqz
  global.get $assembly/index/choreValuesPtr
  i32.eqz
  local.get $0
  i32.const 0
  i32.le_s
  i32.or
  i32.or
  if
   i32.const 0
   return
  end
  local.get $0
  global.get $assembly/index/choreValuesCapacity
  local.tee $4
  local.get $0
  local.get $4
  i32.lt_s
  select
  local.tee $0
  global.get $assembly/index/choreIndicesCapacity
  local.tee $4
  local.get $0
  local.get $4
  i32.lt_s
  select
  local.set $0
  loop $for-loop|0
   local.get $0
   local.get $3
   i32.gt_s
   if
    global.get $assembly/index/choreValuesPtr
    local.get $3
    i32.const 2
    i32.shl
    i32.add
    f32.load
    f64.promote_f32
    local.get $1
    f64.gt
    if
     global.get $assembly/index/choreIndicesPtr
     local.get $2
     i32.const 2
     i32.shl
     i32.add
     local.get $3
     i32.store
     local.get $2
     i32.const 1
     i32.add
     local.set $2
    end
    local.get $3
    i32.const 1
    i32.add
    local.set $3
    br $for-loop|0
   end
  end
  local.get $2
 )
 (func $assembly/index/choresReduce (param $0 i32) (param $1 i32) (result f64)
  (local $2 f64)
  (local $3 f64)
  (local $4 i32)
  (local $5 i32)
  global.get $assembly/index/choreValuesPtr
  i32.eqz
  local.get $0
  i32.const 0
  i32.le_s
  i32.or
  if
   f64.const 0
   return
  end
  local.get $0
  global.get $assembly/index/choreValuesCapacity
  local.tee $5
  local.get $0
  local.get $5
  i32.lt_s
  select
  local.tee $0
  i32.const 0
  i32.le_s
  if
   f64.const 0
   return
  end
  local.get $1
  i32.eqz
  if
   loop $for-loop|0
    local.get $0
    local.get $4
    i32.gt_s
    if
     local.get $2
     global.get $assembly/index/choreValuesPtr
     local.get $4
     i32.const 2
     i32.shl
     i32.add
     f32.load
     f64.promote_f32
     f64.add
     local.set $2
     local.get $4
     i32.const 1
     i32.add
     local.set $4
     br $for-loop|0
    end
   end
   local.get $2
   return
  end
  global.get $assembly/index/choreValuesPtr
  f32.load
  f64.promote_f32
  local.set $2
  local.get $1
  i32.const 1
  i32.eq
  if
   i32.const 1
   local.set $1
   loop $for-loop|1
    local.get $0
    local.get $1
    i32.gt_s
    if
     global.get $assembly/index/choreValuesPtr
     local.get $1
     i32.const 2
     i32.shl
     i32.add
     f32.load
     f64.promote_f32
     local.tee $3
     local.get $2
     f64.gt
     if
      local.get $3
      local.set $2
     end
     local.get $1
     i32.const 1
     i32.add
     local.set $1
     br $for-loop|1
    end
   end
  else
   i32.const 1
   local.set $1
   loop $for-loop|2
    local.get $0
    local.get $1
    i32.gt_s
    if
     global.get $assembly/index/choreValuesPtr
     local.get $1
     i32.const 2
     i32.shl
     i32.add
     f32.load
     f64.promote_f32
     local.tee $3
     local.get $2
     f64.lt
     if
      local.get $3
      local.set $2
     end
     local.get $1
     i32.const 1
     i32.add
     local.set $1
     br $for-loop|2
    end
   end
  end
  local.get $2
 )
 (func $assembly/noise/fractalNoise2D (param $0 f32) (param $1 f32) (param $2 i32) (param $3 f32) (param $4 f32) (result f32)
  (local $5 f32)
  (local $6 f32)
  (local $7 i32)
  (local $8 f32)
  (local $9 f32)
  f32.const 1
  local.set $5
  f32.const 1
  local.set $6
  loop $for-loop|0
   local.get $2
   local.get $7
   i32.gt_s
   if
    local.get $8
    local.get $0
    local.get $6
    f32.mul
    local.get $1
    local.get $6
    f32.mul
    call $assembly/noise/simplexNoise2D
    local.get $5
    f32.mul
    f32.add
    local.set $8
    local.get $9
    local.get $5
    f32.add
    local.set $9
    local.get $5
    local.get $4
    f32.mul
    local.set $5
    local.get $6
    local.get $3
    f32.mul
    local.set $6
    local.get $7
    i32.const 1
    i32.add
    local.set $7
    br $for-loop|0
   end
  end
  local.get $8
  local.get $9
  f32.div
 )
 (func $assembly/noise/fractalNoise3D (param $0 f32) (param $1 f32) (param $2 f32) (param $3 i32) (param $4 f32) (param $5 f32) (result f32)
  (local $6 f32)
  (local $7 f32)
  (local $8 i32)
  (local $9 f32)
  (local $10 f32)
  f32.const 1
  local.set $7
  f32.const 1
  local.set $6
  loop $for-loop|0
   local.get $3
   local.get $8
   i32.gt_s
   if
    local.get $9
    local.get $0
    local.get $6
    f32.mul
    local.get $1
    local.get $6
    f32.mul
    local.get $2
    local.get $6
    f32.mul
    call $assembly/noise/simplexNoise3D
    local.get $7
    f32.mul
    f32.add
    local.set $9
    local.get $10
    local.get $7
    f32.add
    local.set $10
    local.get $7
    local.get $5
    f32.mul
    local.set $7
    local.get $6
    local.get $4
    f32.mul
    local.set $6
    local.get $8
    i32.const 1
    i32.add
    local.set $8
    br $for-loop|0
   end
  end
  local.get $9
  local.get $10
  f32.div
 )
 (func $assembly/physics/allocPhysicsBodies (param $0 i32) (result i32)
  (local $1 i32)
  local.get $0
  global.get $assembly/physics/bodiesCapacity
  i32.gt_s
  if
   local.get $0
   i32.const 5
   i32.shl
   local.set $1
   global.get $assembly/physics/bodiesCapacity
   if (result i32)
    global.get $assembly/physics/bodiesPtr
    local.get $1
    call $~lib/memory/heap.realloc
   else
    global.get $~lib/rt/tlsf/ROOT
    i32.eqz
    if
     call $~lib/rt/tlsf/initialize
    end
    global.get $~lib/rt/tlsf/ROOT
    local.get $1
    call $~lib/rt/tlsf/allocateBlock
    i32.const 4
    i32.add
   end
   global.set $assembly/physics/bodiesPtr
   local.get $0
   global.set $assembly/physics/bodiesCapacity
  end
  global.get $assembly/physics/bodiesPtr
 )
 (func $assembly/physics/stepPhysics (param $0 i32) (param $1 f32) (param $2 f32)
  (local $3 i32)
  (local $4 i32)
  (local $5 f32)
  (local $6 f32)
  (local $7 f32)
  (local $8 f32)
  global.get $assembly/physics/bodiesPtr
  i32.eqz
  local.get $0
  i32.const 0
  i32.le_s
  i32.or
  if
   return
  end
  local.get $1
  local.get $1
  f32.mul
  local.set $1
  loop $for-loop|0
   local.get $0
   local.get $4
   i32.gt_s
   if
    global.get $assembly/physics/bodiesPtr
    local.get $4
    i32.const 5
    i32.shl
    i32.add
    local.tee $3
    f32.load
    local.set $7
    local.get $3
    f32.load offset=4
    local.set $8
    local.get $3
    f32.load offset=12
    local.set $5
    local.get $3
    f32.load offset=20
    local.get $2
    f32.add
    local.set $6
    local.get $3
    local.get $7
    local.get $7
    f32.add
    local.get $3
    f32.load offset=8
    f32.sub
    local.get $3
    f32.load offset=16
    local.get $1
    f32.mul
    f32.add
    f32.store
    local.get $3
    local.get $8
    local.get $8
    f32.add
    local.get $5
    f32.sub
    local.get $6
    local.get $1
    f32.mul
    f32.add
    f32.store offset=4
    local.get $3
    local.get $7
    f32.store offset=8
    local.get $3
    local.get $8
    f32.store offset=12
    local.get $3
    f32.const 0
    f32.store offset=16
    local.get $3
    f32.const 0
    f32.store offset=20
    local.get $4
    i32.const 1
    i32.add
    local.set $4
    br $for-loop|0
   end
  end
 )
 (func $assembly/physics/getBodyPositionX (param $0 i32) (result f32)
  global.get $assembly/physics/bodiesPtr
  i32.eqz
  local.get $0
  i32.const 0
  i32.lt_s
  i32.or
  local.get $0
  global.get $assembly/physics/bodiesCapacity
  i32.ge_s
  i32.or
  if
   f32.const 0
   return
  end
  global.get $assembly/physics/bodiesPtr
  local.get $0
  i32.const 5
  i32.shl
  i32.add
  f32.load
 )
 (func $assembly/physics/getBodyPositionY (param $0 i32) (result f32)
  global.get $assembly/physics/bodiesPtr
  i32.eqz
  local.get $0
  i32.const 0
  i32.lt_s
  i32.or
  local.get $0
  global.get $assembly/physics/bodiesCapacity
  i32.ge_s
  i32.or
  if
   f32.const 0
   return
  end
  global.get $assembly/physics/bodiesPtr
  local.get $0
  i32.const 5
  i32.shl
  i32.add
  f32.load offset=4
 )
 (func $assembly/physics/setBodyPosition (param $0 i32) (param $1 f32) (param $2 f32)
  global.get $assembly/physics/bodiesPtr
  i32.eqz
  local.get $0
  i32.const 0
  i32.lt_s
  i32.or
  local.get $0
  global.get $assembly/physics/bodiesCapacity
  i32.ge_s
  i32.or
  if
   return
  end
  global.get $assembly/physics/bodiesPtr
  local.get $0
  i32.const 5
  i32.shl
  i32.add
  local.tee $0
  local.get $1
  f32.store
  local.get $0
  local.get $2
  f32.store offset=4
  local.get $0
  local.get $1
  f32.store offset=8
  local.get $0
  local.get $2
  f32.store offset=12
 )
 (func $assembly/physics/addBodyAcceleration (param $0 i32) (param $1 f32) (param $2 f32)
  global.get $assembly/physics/bodiesPtr
  i32.eqz
  local.get $0
  i32.const 0
  i32.lt_s
  i32.or
  local.get $0
  global.get $assembly/physics/bodiesCapacity
  i32.ge_s
  i32.or
  if
   return
  end
  global.get $assembly/physics/bodiesPtr
  local.get $0
  i32.const 5
  i32.shl
  i32.add
  local.tee $0
  local.get $0
  f32.load offset=16
  local.get $1
  f32.add
  f32.store offset=16
  local.get $0
  local.get $0
  f32.load offset=20
  local.get $2
  f32.add
  f32.store offset=20
 )
 (func $assembly/physics/getBodyRadius (param $0 i32) (result f32)
  global.get $assembly/physics/bodiesPtr
  i32.eqz
  local.get $0
  i32.const 0
  i32.lt_s
  i32.or
  local.get $0
  global.get $assembly/physics/bodiesCapacity
  i32.ge_s
  i32.or
  if
   f32.const 0
   return
  end
  global.get $assembly/physics/bodiesPtr
  local.get $0
  i32.const 5
  i32.shl
  i32.add
  f32.load offset=28
 )
 (func $~lib/rt/__visit_members (param $0 i32)
  block $invalid
   block $~lib/staticarray/StaticArray<f32>
    block $~lib/staticarray/StaticArray<i32>
     block $~lib/arraybuffer/ArrayBufferView
      block $~lib/string/String
       block $~lib/arraybuffer/ArrayBuffer
        block $~lib/object/Object
         local.get $0
         i32.const 8
         i32.sub
         i32.load
         br_table $~lib/object/Object $~lib/arraybuffer/ArrayBuffer $~lib/string/String $~lib/arraybuffer/ArrayBufferView $~lib/staticarray/StaticArray<i32> $~lib/staticarray/StaticArray<f32> $invalid
        end
        return
       end
       return
      end
      return
     end
     local.get $0
     i32.load
     local.tee $0
     if
      local.get $0
      call $~lib/rt/itcms/__visit
     end
     return
    end
    return
   end
   return
  end
  unreachable
 )
 (func $~start
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 2812
  i32.lt_s
  if
   i32.const 35600
   i32.const 35648
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  memory.size
  i32.const 16
  i32.shl
  i32.const 35580
  i32.sub
  i32.const 1
  i32.shr_u
  global.set $~lib/rt/itcms/threshold
  i32.const 2516
  i32.const 2512
  i32.store
  i32.const 2520
  i32.const 2512
  i32.store
  i32.const 2512
  global.set $~lib/rt/itcms/pinSpace
  i32.const 2548
  i32.const 2544
  i32.store
  i32.const 2552
  i32.const 2544
  i32.store
  i32.const 2544
  global.set $~lib/rt/itcms/toSpace
  i32.const 2692
  i32.const 2688
  i32.store
  i32.const 2696
  i32.const 2688
  i32.store
  i32.const 2688
  global.set $~lib/rt/itcms/fromSpace
  call $~lib/staticarray/StaticArray<i32>#constructor
  global.set $assembly/noise/perm
  call $~lib/staticarray/StaticArray<i32>#constructor
  global.set $assembly/noise/perm12
  loop $for-loop|0
   local.get $0
   i32.const 512
   i32.lt_s
   if
    global.get $~lib/memory/__stack_pointer
    global.get $assembly/noise/perm
    local.tee $1
    i32.store
    global.get $~lib/memory/__stack_pointer
    i32.const 1056
    i32.store offset=4
    local.get $1
    local.get $0
    i32.const 1056
    local.get $0
    i32.const 255
    i32.and
    call $~lib/staticarray/StaticArray<i32>#__get
    call $~lib/staticarray/StaticArray<i32>#__set
    global.get $~lib/memory/__stack_pointer
    global.get $assembly/noise/perm12
    local.tee $1
    i32.store
    global.get $~lib/memory/__stack_pointer
    global.get $assembly/noise/perm
    local.tee $2
    i32.store offset=4
    local.get $1
    local.get $0
    local.get $2
    local.get $0
    call $~lib/staticarray/StaticArray<i32>#__get
    i32.const 12
    i32.rem_s
    call $~lib/staticarray/StaticArray<i32>#__set
    local.get $0
    i32.const 1
    i32.add
    local.set $0
    br $for-loop|0
   end
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/staticarray/StaticArray<i32>#__get (param $0 i32) (param $1 i32) (result i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 2812
  i32.lt_s
  if
   i32.const 35600
   i32.const 35648
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store
  local.get $1
  local.get $0
  i32.const 20
  i32.sub
  i32.load offset=16
  i32.const 2
  i32.shr_u
  i32.ge_u
  if
   i32.const 2592
   i32.const 2336
   i32.const 78
   i32.const 41
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  local.get $1
  i32.const 2
  i32.shl
  i32.add
  i32.load
  local.set $0
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $0
 )
 (func $~lib/staticarray/StaticArray<i32>#__set (param $0 i32) (param $1 i32) (param $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 2812
  i32.lt_s
  if
   i32.const 35600
   i32.const 35648
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store
  local.get $1
  local.get $0
  i32.const 20
  i32.sub
  i32.load offset=16
  i32.const 2
  i32.shr_u
  i32.ge_u
  if
   i32.const 2592
   i32.const 2336
   i32.const 93
   i32.const 41
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store
  local.get $0
  local.get $1
  i32.const 2
  i32.shl
  i32.add
  local.get $2
  i32.store
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/staticarray/StaticArray<f32>#__get (param $0 i32) (result f32)
  (local $1 f32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 2812
  i32.lt_s
  if
   i32.const 35600
   i32.const 35648
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  global.get $~lib/memory/__stack_pointer
  i32.const 2112
  i32.store
  local.get $0
  i32.const 2108
  i32.load
  i32.const 2
  i32.shr_u
  i32.ge_u
  if
   i32.const 2592
   i32.const 2336
   i32.const 78
   i32.const 41
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.const 2
  i32.shl
  i32.const 2112
  i32.add
  f32.load
  local.set $1
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $1
 )
 (func $assembly/noise/simplexNoise2D (param $0 f32) (param $1 f32) (result f32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 f32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  (local $10 i32)
  (local $11 f32)
  (local $12 f32)
  (local $13 f32)
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 2812
  i32.lt_s
  if
   i32.const 35600
   i32.const 35648
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  local.get $0
  local.get $0
  local.get $0
  local.get $1
  f32.add
  f32.const 0.3660253882408142
  f32.mul
  local.tee $0
  f32.add
  f32.floor
  i32.trunc_sat_f32_s
  local.tee $4
  f32.convert_i32_s
  local.get $1
  local.get $0
  f32.add
  f32.floor
  i32.trunc_sat_f32_s
  local.tee $5
  local.get $4
  i32.add
  f32.convert_i32_s
  f32.const 0.21132487058639526
  f32.mul
  local.tee $0
  f32.sub
  f32.sub
  local.tee $6
  local.get $1
  local.get $5
  f32.convert_i32_s
  local.get $0
  f32.sub
  f32.sub
  local.tee $1
  f32.gt
  if (result i32)
   i32.const 1
  else
   i32.const 1
   local.set $2
   i32.const 0
  end
  local.set $3
  global.get $~lib/memory/__stack_pointer
  global.get $assembly/noise/perm12
  local.tee $7
  i32.store
  global.get $~lib/memory/__stack_pointer
  global.get $assembly/noise/perm
  local.tee $8
  i32.store offset=4
  local.get $7
  local.get $8
  local.get $5
  i32.const 255
  i32.and
  local.tee $5
  call $~lib/staticarray/StaticArray<i32>#__get
  local.get $4
  i32.const 255
  i32.and
  local.tee $7
  i32.add
  call $~lib/staticarray/StaticArray<i32>#__get
  local.set $8
  global.get $~lib/memory/__stack_pointer
  global.get $assembly/noise/perm12
  local.tee $4
  i32.store
  global.get $~lib/memory/__stack_pointer
  global.get $assembly/noise/perm
  local.tee $9
  i32.store offset=4
  local.get $4
  local.get $9
  local.get $2
  local.get $5
  i32.add
  call $~lib/staticarray/StaticArray<i32>#__get
  local.get $3
  local.get $7
  i32.add
  i32.add
  call $~lib/staticarray/StaticArray<i32>#__get
  local.set $9
  global.get $~lib/memory/__stack_pointer
  global.get $assembly/noise/perm12
  local.tee $10
  i32.store
  global.get $~lib/memory/__stack_pointer
  global.get $assembly/noise/perm
  local.tee $4
  i32.store offset=4
  local.get $10
  local.get $4
  local.get $5
  i32.const 1
  i32.add
  call $~lib/staticarray/StaticArray<i32>#__get
  local.get $7
  i32.const 1
  i32.add
  i32.add
  call $~lib/staticarray/StaticArray<i32>#__get
  local.set $4
  f32.const 0.5
  local.get $6
  local.get $6
  f32.mul
  f32.sub
  local.get $1
  local.get $1
  f32.mul
  f32.sub
  local.tee $0
  f32.const 0
  f32.ge
  if (result f32)
   global.get $~lib/memory/__stack_pointer
   i32.const 2112
   i32.store
   local.get $8
   i32.const 3
   i32.mul
   local.tee $5
   call $~lib/staticarray/StaticArray<f32>#__get
   local.get $6
   f32.mul
   local.set $11
   global.get $~lib/memory/__stack_pointer
   i32.const 2112
   i32.store
   local.get $0
   local.get $0
   f32.mul
   local.tee $0
   local.get $0
   f32.mul
   local.get $11
   local.get $5
   i32.const 1
   i32.add
   call $~lib/staticarray/StaticArray<f32>#__get
   local.get $1
   f32.mul
   f32.add
   f32.mul
  else
   f32.const 0
  end
  local.set $11
  f32.const 0.5
  local.get $6
  local.get $3
  f32.convert_i32_s
  f32.sub
  f32.const 0.21132487058639526
  f32.add
  local.tee $12
  local.get $12
  f32.mul
  f32.sub
  local.get $1
  local.get $2
  f32.convert_i32_s
  f32.sub
  f32.const 0.21132487058639526
  f32.add
  local.tee $13
  local.get $13
  f32.mul
  f32.sub
  local.tee $0
  f32.const 0
  f32.ge
  if (result f32)
   global.get $~lib/memory/__stack_pointer
   i32.const 2112
   i32.store
   local.get $9
   i32.const 3
   i32.mul
   local.tee $2
   call $~lib/staticarray/StaticArray<f32>#__get
   local.get $12
   f32.mul
   local.set $12
   global.get $~lib/memory/__stack_pointer
   i32.const 2112
   i32.store
   local.get $0
   local.get $0
   f32.mul
   local.tee $0
   local.get $0
   f32.mul
   local.get $12
   local.get $2
   i32.const 1
   i32.add
   call $~lib/staticarray/StaticArray<f32>#__get
   local.get $13
   f32.mul
   f32.add
   f32.mul
  else
   f32.const 0
  end
  local.set $0
  f32.const 0.5
  local.get $6
  f32.const -1
  f32.add
  f32.const 0.4226497411727905
  f32.add
  local.tee $6
  local.get $6
  f32.mul
  f32.sub
  local.get $1
  f32.const -1
  f32.add
  f32.const 0.4226497411727905
  f32.add
  local.tee $1
  local.get $1
  f32.mul
  f32.sub
  local.tee $12
  f32.const 0
  f32.ge
  if (result f32)
   global.get $~lib/memory/__stack_pointer
   i32.const 2112
   i32.store
   local.get $4
   i32.const 3
   i32.mul
   local.tee $2
   call $~lib/staticarray/StaticArray<f32>#__get
   local.get $6
   f32.mul
   local.set $6
   global.get $~lib/memory/__stack_pointer
   i32.const 2112
   i32.store
   local.get $12
   local.get $12
   f32.mul
   local.tee $12
   local.get $12
   f32.mul
   local.get $6
   local.get $2
   i32.const 1
   i32.add
   call $~lib/staticarray/StaticArray<f32>#__get
   local.get $1
   f32.mul
   f32.add
   f32.mul
  else
   f32.const 0
  end
  local.set $1
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $11
  local.get $0
  f32.add
  local.get $1
  f32.add
  f32.const 70
  f32.mul
 )
 (func $assembly/noise/simplexNoise3D (param $0 f32) (param $1 f32) (param $2 f32) (result f32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 f32)
  (local $9 f32)
  (local $10 i32)
  (local $11 i32)
  (local $12 i32)
  (local $13 i32)
  (local $14 f32)
  (local $15 i32)
  (local $16 i32)
  (local $17 i32)
  (local $18 i32)
  (local $19 i32)
  (local $20 i32)
  (local $21 f32)
  (local $22 f32)
  (local $23 f32)
  global.get $~lib/memory/__stack_pointer
  i32.const 12
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 2812
  i32.lt_s
  if
   i32.const 35600
   i32.const 35648
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store offset=8
  local.get $0
  local.get $0
  local.get $1
  f32.add
  local.get $2
  f32.add
  f32.const 0.3333333432674408
  f32.mul
  local.tee $8
  f32.add
  f32.floor
  i32.trunc_sat_f32_s
  local.tee $11
  local.get $1
  local.get $8
  f32.add
  f32.floor
  i32.trunc_sat_f32_s
  local.tee $12
  i32.add
  local.get $2
  local.get $8
  f32.add
  f32.floor
  i32.trunc_sat_f32_s
  local.tee $13
  i32.add
  f32.convert_i32_s
  f32.const 0.1666666716337204
  f32.mul
  local.set $14
  local.get $2
  local.get $13
  f32.convert_i32_s
  local.get $14
  f32.sub
  f32.sub
  local.set $8
  local.get $0
  local.get $11
  f32.convert_i32_s
  local.get $14
  f32.sub
  f32.sub
  local.tee $9
  local.get $1
  local.get $12
  f32.convert_i32_s
  local.get $14
  f32.sub
  f32.sub
  local.tee $14
  f32.ge
  if (result i32)
   local.get $8
   local.get $14
   f32.le
   if (result i32)
    i32.const 1
    local.set $3
    i32.const 1
    local.set $5
    i32.const 1
   else
    local.get $8
    local.get $9
    f32.le
    if (result i32)
     i32.const 1
     local.set $3
     i32.const 1
     local.set $4
     i32.const 1
    else
     i32.const 1
     local.set $6
     i32.const 1
     local.set $3
     i32.const 1
     local.set $4
     i32.const 0
    end
   end
  else
   local.get $8
   local.get $14
   f32.gt
   if (result i32)
    i32.const 1
    local.set $6
    i32.const 1
    local.set $4
    i32.const 1
   else
    local.get $8
    local.get $9
    f32.gt
    if (result i32)
     i32.const 1
     local.set $7
     i32.const 1
     local.set $4
     i32.const 1
    else
     i32.const 1
     local.set $7
     i32.const 1
     local.set $3
     i32.const 1
    end
   end
   local.set $5
   i32.const 0
  end
  local.set $10
  global.get $~lib/memory/__stack_pointer
  global.get $assembly/noise/perm12
  local.tee $15
  i32.store
  global.get $~lib/memory/__stack_pointer
  global.get $assembly/noise/perm
  local.tee $16
  i32.store offset=4
  global.get $~lib/memory/__stack_pointer
  global.get $assembly/noise/perm
  local.tee $17
  i32.store offset=8
  local.get $15
  local.get $16
  local.get $17
  local.get $13
  i32.const 255
  i32.and
  local.tee $13
  call $~lib/staticarray/StaticArray<i32>#__get
  local.get $12
  i32.const 255
  i32.and
  local.tee $12
  i32.add
  call $~lib/staticarray/StaticArray<i32>#__get
  local.get $11
  i32.const 255
  i32.and
  local.tee $15
  i32.add
  call $~lib/staticarray/StaticArray<i32>#__get
  local.set $16
  global.get $~lib/memory/__stack_pointer
  global.get $assembly/noise/perm12
  local.tee $11
  i32.store
  global.get $~lib/memory/__stack_pointer
  global.get $assembly/noise/perm
  local.tee $17
  i32.store offset=4
  global.get $~lib/memory/__stack_pointer
  global.get $assembly/noise/perm
  local.tee $18
  i32.store offset=8
  local.get $11
  local.get $17
  local.get $18
  local.get $6
  local.get $13
  i32.add
  call $~lib/staticarray/StaticArray<i32>#__get
  local.get $7
  local.get $12
  i32.add
  i32.add
  call $~lib/staticarray/StaticArray<i32>#__get
  local.get $10
  local.get $15
  i32.add
  i32.add
  call $~lib/staticarray/StaticArray<i32>#__get
  local.set $17
  global.get $~lib/memory/__stack_pointer
  global.get $assembly/noise/perm12
  local.tee $11
  i32.store
  global.get $~lib/memory/__stack_pointer
  global.get $assembly/noise/perm
  local.tee $18
  i32.store offset=4
  global.get $~lib/memory/__stack_pointer
  global.get $assembly/noise/perm
  local.tee $19
  i32.store offset=8
  local.get $11
  local.get $18
  local.get $19
  local.get $4
  local.get $13
  i32.add
  call $~lib/staticarray/StaticArray<i32>#__get
  local.get $5
  local.get $12
  i32.add
  i32.add
  call $~lib/staticarray/StaticArray<i32>#__get
  local.get $3
  local.get $15
  i32.add
  i32.add
  call $~lib/staticarray/StaticArray<i32>#__get
  local.set $18
  global.get $~lib/memory/__stack_pointer
  global.get $assembly/noise/perm12
  local.tee $19
  i32.store
  global.get $~lib/memory/__stack_pointer
  global.get $assembly/noise/perm
  local.tee $20
  i32.store offset=4
  global.get $~lib/memory/__stack_pointer
  global.get $assembly/noise/perm
  local.tee $11
  i32.store offset=8
  local.get $19
  local.get $20
  local.get $11
  local.get $13
  i32.const 1
  i32.add
  call $~lib/staticarray/StaticArray<i32>#__get
  local.get $12
  i32.const 1
  i32.add
  i32.add
  call $~lib/staticarray/StaticArray<i32>#__get
  local.get $15
  i32.const 1
  i32.add
  i32.add
  call $~lib/staticarray/StaticArray<i32>#__get
  local.set $11
  f32.const 0.6000000238418579
  local.get $9
  local.get $9
  f32.mul
  f32.sub
  local.get $14
  local.get $14
  f32.mul
  f32.sub
  local.get $8
  local.get $8
  f32.mul
  f32.sub
  local.tee $0
  f32.const 0
  f32.ge
  if (result f32)
   global.get $~lib/memory/__stack_pointer
   i32.const 2112
   i32.store
   local.get $16
   i32.const 3
   i32.mul
   local.tee $12
   call $~lib/staticarray/StaticArray<f32>#__get
   local.get $9
   f32.mul
   local.set $1
   global.get $~lib/memory/__stack_pointer
   i32.const 2112
   i32.store
   local.get $1
   local.get $12
   i32.const 1
   i32.add
   call $~lib/staticarray/StaticArray<f32>#__get
   local.get $14
   f32.mul
   f32.add
   local.set $1
   global.get $~lib/memory/__stack_pointer
   i32.const 2112
   i32.store
   local.get $0
   local.get $0
   f32.mul
   local.tee $0
   local.get $0
   f32.mul
   local.get $1
   local.get $12
   i32.const 2
   i32.add
   call $~lib/staticarray/StaticArray<f32>#__get
   local.get $8
   f32.mul
   f32.add
   f32.mul
  else
   f32.const 0
  end
  local.set $0
  f32.const 0.6000000238418579
  local.get $9
  local.get $10
  f32.convert_i32_s
  f32.sub
  f32.const 0.1666666716337204
  f32.add
  local.tee $1
  local.get $1
  f32.mul
  f32.sub
  local.get $14
  local.get $7
  f32.convert_i32_s
  f32.sub
  f32.const 0.1666666716337204
  f32.add
  local.tee $2
  local.get $2
  f32.mul
  f32.sub
  local.get $8
  local.get $6
  f32.convert_i32_s
  f32.sub
  f32.const 0.1666666716337204
  f32.add
  local.tee $21
  local.get $21
  f32.mul
  f32.sub
  local.tee $22
  f32.const 0
  f32.ge
  if (result f32)
   global.get $~lib/memory/__stack_pointer
   i32.const 2112
   i32.store
   local.get $17
   i32.const 3
   i32.mul
   local.tee $6
   call $~lib/staticarray/StaticArray<f32>#__get
   local.get $1
   f32.mul
   local.set $1
   global.get $~lib/memory/__stack_pointer
   i32.const 2112
   i32.store
   local.get $1
   local.get $6
   i32.const 1
   i32.add
   call $~lib/staticarray/StaticArray<f32>#__get
   local.get $2
   f32.mul
   f32.add
   local.set $1
   global.get $~lib/memory/__stack_pointer
   i32.const 2112
   i32.store
   local.get $22
   local.get $22
   f32.mul
   local.tee $2
   local.get $2
   f32.mul
   local.get $1
   local.get $6
   i32.const 2
   i32.add
   call $~lib/staticarray/StaticArray<f32>#__get
   local.get $21
   f32.mul
   f32.add
   f32.mul
  else
   f32.const 0
  end
  local.set $1
  f32.const 0.6000000238418579
  local.get $9
  local.get $3
  f32.convert_i32_s
  f32.sub
  f32.const 0.3333333432674408
  f32.add
  local.tee $2
  local.get $2
  f32.mul
  f32.sub
  local.get $14
  local.get $5
  f32.convert_i32_s
  f32.sub
  f32.const 0.3333333432674408
  f32.add
  local.tee $21
  local.get $21
  f32.mul
  f32.sub
  local.get $8
  local.get $4
  f32.convert_i32_s
  f32.sub
  f32.const 0.3333333432674408
  f32.add
  local.tee $22
  local.get $22
  f32.mul
  f32.sub
  local.tee $23
  f32.const 0
  f32.ge
  if (result f32)
   global.get $~lib/memory/__stack_pointer
   i32.const 2112
   i32.store
   local.get $18
   i32.const 3
   i32.mul
   local.tee $3
   call $~lib/staticarray/StaticArray<f32>#__get
   local.get $2
   f32.mul
   local.set $2
   global.get $~lib/memory/__stack_pointer
   i32.const 2112
   i32.store
   local.get $2
   local.get $3
   i32.const 1
   i32.add
   call $~lib/staticarray/StaticArray<f32>#__get
   local.get $21
   f32.mul
   f32.add
   local.set $2
   global.get $~lib/memory/__stack_pointer
   i32.const 2112
   i32.store
   local.get $23
   local.get $23
   f32.mul
   local.tee $21
   local.get $21
   f32.mul
   local.get $2
   local.get $3
   i32.const 2
   i32.add
   call $~lib/staticarray/StaticArray<f32>#__get
   local.get $22
   f32.mul
   f32.add
   f32.mul
  else
   f32.const 0
  end
  local.set $2
  f32.const 0.6000000238418579
  local.get $9
  f32.const -1
  f32.add
  f32.const 0.5
  f32.add
  local.tee $9
  local.get $9
  f32.mul
  f32.sub
  local.get $14
  f32.const -1
  f32.add
  f32.const 0.5
  f32.add
  local.tee $14
  local.get $14
  f32.mul
  f32.sub
  local.get $8
  f32.const -1
  f32.add
  f32.const 0.5
  f32.add
  local.tee $8
  local.get $8
  f32.mul
  f32.sub
  local.tee $21
  f32.const 0
  f32.ge
  if (result f32)
   global.get $~lib/memory/__stack_pointer
   i32.const 2112
   i32.store
   local.get $11
   i32.const 3
   i32.mul
   local.tee $3
   call $~lib/staticarray/StaticArray<f32>#__get
   local.get $9
   f32.mul
   local.set $9
   global.get $~lib/memory/__stack_pointer
   i32.const 2112
   i32.store
   local.get $9
   local.get $3
   i32.const 1
   i32.add
   call $~lib/staticarray/StaticArray<f32>#__get
   local.get $14
   f32.mul
   f32.add
   local.set $9
   global.get $~lib/memory/__stack_pointer
   i32.const 2112
   i32.store
   local.get $21
   local.get $21
   f32.mul
   local.tee $14
   local.get $14
   f32.mul
   local.get $9
   local.get $3
   i32.const 2
   i32.add
   call $~lib/staticarray/StaticArray<f32>#__get
   local.get $8
   f32.mul
   f32.add
   f32.mul
  else
   f32.const 0
  end
  local.set $8
  global.get $~lib/memory/__stack_pointer
  i32.const 12
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $0
  local.get $1
  f32.add
  local.get $2
  f32.add
  local.get $8
  f32.add
  f32.const 32
  f32.mul
 )
 (func $~lib/staticarray/StaticArray<i32>#constructor (result i32)
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 2812
  i32.lt_s
  if
   i32.const 35600
   i32.const 35648
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  global.get $~lib/memory/__stack_pointer
  global.get $~lib/rt/itcms/total
  global.get $~lib/rt/itcms/threshold
  i32.ge_u
  if
   block $__inlined_func$~lib/rt/itcms/interrupt$68
    i32.const 2048
    local.set $0
    loop $do-loop|0
     local.get $0
     call $~lib/rt/itcms/step
     i32.sub
     local.set $0
     global.get $~lib/rt/itcms/state
     i32.eqz
     if
      global.get $~lib/rt/itcms/total
      i64.extend_i32_u
      i64.const 200
      i64.mul
      i64.const 100
      i64.div_u
      i32.wrap_i64
      i32.const 1024
      i32.add
      global.set $~lib/rt/itcms/threshold
      br $__inlined_func$~lib/rt/itcms/interrupt$68
     end
     local.get $0
     i32.const 0
     i32.gt_s
     br_if $do-loop|0
    end
    global.get $~lib/rt/itcms/total
    global.get $~lib/rt/itcms/total
    global.get $~lib/rt/itcms/threshold
    i32.sub
    i32.const 1024
    i32.lt_u
    i32.const 10
    i32.shl
    i32.add
    global.set $~lib/rt/itcms/threshold
   end
  end
  global.get $~lib/rt/tlsf/ROOT
  i32.eqz
  if
   call $~lib/rt/tlsf/initialize
  end
  global.get $~lib/rt/tlsf/ROOT
  i32.const 2064
  call $~lib/rt/tlsf/allocateBlock
  local.tee $1
  i32.const 4
  i32.store offset=12
  local.get $1
  i32.const 2048
  i32.store offset=16
  global.get $~lib/rt/itcms/fromSpace
  local.tee $0
  i32.load offset=8
  local.set $2
  local.get $1
  local.get $0
  global.get $~lib/rt/itcms/white
  i32.or
  i32.store offset=4
  local.get $1
  local.get $2
  i32.store offset=8
  local.get $2
  local.get $1
  local.get $2
  i32.load offset=4
  i32.const 3
  i32.and
  i32.or
  i32.store offset=4
  local.get $0
  local.get $1
  i32.store offset=8
  global.get $~lib/rt/itcms/total
  local.get $1
  i32.load
  i32.const -4
  i32.and
  i32.const 4
  i32.add
  i32.add
  global.set $~lib/rt/itcms/total
  local.get $1
  i32.const 20
  i32.add
  local.tee $0
  i32.const 0
  i32.const 2048
  memory.fill
  local.get $0
  i32.store
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $0
 )
)
