async function main() {
  const THREE = await import("three");
  const target = new THREE.Vector3(0, 0, 1);
  const v = new THREE.Vector3(-0.42, 1.32, -1.47).normalize();

  // We want to find a rotation of the earth group (with order XYZ or YXZ).
  // that brings v to target.
  // But the earth might have arbitrary rotations.
  // we want to rotate earth such that earth.localToWorld(v) == target.
  // so earth.quaternion * v = target.
  // earth.quaternion = quaternion that rotates v to target.
  const q = new THREE.Quaternion().setFromUnitVectors(v, target);
  const e = new THREE.Euler().setFromQuaternion(q, "XYZ");
  console.log("To point exactly at +Z:");
  console.log("x:", e.x, "y:", e.y, "z:", e.z);

  // Since the camera is looking slightly down/up, maybe we need to pitch it.
  const cameraDir = new THREE.Vector3(0, 0.8 - 0.5, -0.5 - 2.05).normalize().negate(); // Vector from surface to camera.
  console.log("Camera dir:", cameraDir);
  const q2 = new THREE.Quaternion().setFromUnitVectors(v, cameraDir);
  const e2 = new THREE.Euler().setFromQuaternion(q2, "XYZ");
  console.log("To point at camera:");
  console.log("x:", e2.x, "y:", e2.y, "z:", e2.z);
}

void main();

