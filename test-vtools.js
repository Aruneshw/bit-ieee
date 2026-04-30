import https from "https";

https.get("https://events.vtools.ieee.org/events/search.json?q=India", (res) => {
  let data = "";
  res.on("data", (chunk) => { data += chunk; });
  res.on("end", () => {
    console.log("Status:", res.statusCode);
    if (res.statusCode === 200) {
      console.log(data.substring(0, 500));
    } else {
      console.log("Failed", res.statusCode);
    }
  });
}).on("error", (err) => {
  console.error("Error:", err.message);
});
