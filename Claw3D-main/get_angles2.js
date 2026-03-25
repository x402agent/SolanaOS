async function main() {
  const THREE = await import("three");

  // Earth rotation order is default XYZ.
  // The beacon's local position.
  const beaconLocal = new THREE.Vector3(-0.42, 1.32, -1.47).normalize();

  // The camera's position during dive.
  const cameraPos = new THREE.Vector3(0, 0.5, 2.05).normalize();

  // We want to rotate beaconLocal to cameraPos.
  // The required quaternion.
  const q = new THREE.Quaternion().setFromUnitVectors(beaconLocal, cameraPos);

  // Convert to Euler so we can damp x and y.
  const e = new THREE.Euler().setFromQuaternion(q, "XYZ");

  console.log("Target Euler:");
  console.log("x:", e.x, "y:", e.y, "z:", e.z);
}

void main();
