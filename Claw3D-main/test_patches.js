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
    NA: { pos: latLonToVector3(45, -100, 1.95), size: 0.8 },
    NY: { pos: latLonToVector3(40.7, -74, 1.95), size: 0.4 },
    SA: { pos: latLonToVector3(-15, -60, 1.95), size: 0.6 },
    EU: { pos: latLonToVector3(50, 15, 1.95), size: 0.6 },
    AF: { pos: latLonToVector3(0, 20, 1.95), size: 0.7 },
    AS: { pos: latLonToVector3(40, 90, 1.95), size: 1.1 },
    AU: { pos: latLonToVector3(-25, 135, 1.95), size: 0.5 },
    GL: { pos: latLonToVector3(75, -40, 1.95), size: 0.5 },
  };

  console.log(JSON.stringify(continents, null, 2));
}

void main();
