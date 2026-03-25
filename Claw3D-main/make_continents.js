async function main() {
  const THREE = await import("three");

  function latLonToVector3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 90) * (Math.PI / 180);
    const x = -radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    return new THREE.Vector3(x, y, z);
  }

  const continents = {
    NA: latLonToVector3(45, -100, 2),
    NY: latLonToVector3(40.7, -74, 2),
    SA: latLonToVector3(-15, -60, 2),
    EU: latLonToVector3(50, 15, 2),
    AF: latLonToVector3(0, 20, 2),
    AS: latLonToVector3(40, 90, 2),
    AU: latLonToVector3(-25, 135, 2),
  };

  for (const [name, v] of Object.entries(continents)) {
    console.log(`${name}: [${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}],`);
  }
}

void main();
