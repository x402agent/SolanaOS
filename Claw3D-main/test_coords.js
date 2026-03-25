async function main() {
  const THREE = await import("three");

  // Earth radius = 2.
  // latitude 40.7, longitude -74.
  function latLonToVector3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    // three.js spherical maps usually have lon=0 at +Z, and lon=90 at +X.
    const theta = (lon + 90) * (Math.PI / 180); // Wait, standard spherical coords in three.js.

    const x = -radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);

    return new THREE.Vector3(x, y, z);
  }

  // NY.
  console.log("NY:", latLonToVector3(40.7, -74, 2));

  // Let's try London.
  console.log("London:", latLonToVector3(51.5, 0, 2));

  // Let's try SF.
  console.log("SF:", latLonToVector3(37.7, -122, 2));
}

void main();
