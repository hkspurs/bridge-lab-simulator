// Throwaway API feasibility probe, not an app backend or calibrated mechanism.
import assert from 'node:assert/strict';
import R from '@dimforge/rapier3d-compat';
import initJolt from 'jolt-physics';
await R.init();
const dt=1/120, inertia=0.001, trials=[];
for (const cap of [0,0.02,0.08]) {
 const w=new R.World({x:0,y:0,z:0}); w.timestep=dt;
 const a=w.createRigidBody(R.RigidBodyDesc.fixed());
 const b=w.createRigidBody(R.RigidBodyDesc.dynamic().setAdditionalMassProperties(1,{x:0,y:0,z:0},{x:inertia,y:inertia,z:inertia},{x:0,y:0,z:0,w:1}).setAngularDamping(0).setCanSleep(false));
 const j=w.createImpulseJoint(R.JointData.revolute({x:0,y:0,z:0},{x:0,y:0,z:0},{x:0,y:0,z:1}),a,b,true);
 j.configureMotorModel(R.MotorModel.ForceBased);j.configureMotorVelocity(100,1000);j.setMotorMaxForce(cap);
 w.step();const omega=b.angvel(); const inferredTorque=inertia*omega.z/dt;
 assert.ok(Math.abs(inferredTorque-cap)<1e-6);
 trials.push({capNm:cap,omegaRadps:omega.z,inferredTorqueNm:inferredTorque});w.free();
}
const J=await initJolt();
const motor=new J.MotorSettings();motor.mMinTorqueLimit=-.08;motor.mMaxTorqueLimit=.08;
const settings=new J.PhysicsSettings(); settings.mNumVelocitySteps=16; settings.mNumPositionSteps=8;settings.mPenetrationSlop=.0001;
const contact=new J.ContactSettings();contact.mCombinedFriction=.34;
const result={rapier:{version:R.version(),nativeTorqueTrials:trials},jolt:{packageVersion:'1.1.0',motorMinNm:motor.mMinTorqueLimit,motorMaxNm:motor.mMaxTorqueLimit,velocityIterations:settings.mNumVelocitySteps,positionIterations:settings.mNumPositionSteps,penetrationSlopM:settings.mPenetrationSlop,contactFriction:contact.mCombinedFriction,contactCallbacks:['OnContactAdded','OnContactPersisted'].map(k=>({name:k,exposed:typeof J.ContactListenerJS.prototype[k]==='function'}))},scope:'Rapier one-step zero-gravity rotor torque only; Jolt initialized WASM setter/getter exposure only. No contact/obstruction/friction accuracy or browser acceptance.'};
for(const x of [motor,settings,contact])J.destroy(x);
console.log(JSON.stringify(result,null,2));
