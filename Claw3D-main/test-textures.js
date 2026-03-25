async function main() {
  const { get } = await import("node:https");
  get(
    "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg",
    (res) => {
      console.log("Status:", res.statusCode);
    },
  );
}

void main();
