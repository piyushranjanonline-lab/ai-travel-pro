import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const app = express();

// fix path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(__dirname));
app.use(express.json());

// 🔑 PUT YOUR OPENROUTER API KEY HERE
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;


// homepage
app.get("/", (req,res)=>{
  res.sendFile(path.join(__dirname,"index.html"));
});


// 🚀 MAIN TRAVEL ROUTE
app.post("/travel", async (req,res)=>{

  const { origin, destination } = req.body;

  console.log("Travel search:", origin, "→", destination);

  const dest = destination.toLowerCase();
  const from = origin.toLowerCase();

  let noFlight = false;
  let noTrain = false;

  // 🏔 hill stations list
  const hillStations = [
    "manali","shimla","kasol","spiti",
    "dharamshala","mussoorie","nainital"
  ];

  // if either origin OR destination is hill station
  if(hillStations.includes(dest) || hillStations.includes(from)){
    noFlight = true;
    noTrain = true;
  }

  // ✈️ leh special case
  if(dest === "leh" || from === "leh"){
    noTrain = true;
  }

  // 🚗 short distance routes
  if(
    (from === "delhi" && dest === "jaipur") ||
    (from === "jaipur" && dest === "delhi")
  ){
    noFlight = true;
  }

  if(
    (from === "mumbai" && dest === "pune") ||
    (from === "pune" && dest === "mumbai")
  ){
    noFlight = true;
  }

  // build restriction message for AI
  let restrictionMessage = "";

  if(noFlight){
    restrictionMessage += "Flight not available or not recommended for this route. ";
  }

  if(noTrain){
    restrictionMessage += "Train not available for this route. ";
  }


  try{

    const prompt = `
User wants to travel from ${origin} to ${destination} in India.

Route intelligence:
${restrictionMessage}

Return ONLY JSON:
{
 "flight": { "price": "", "time": "", "booking": "" },
 "train": { "price": "", "time": "", "booking": "" },
 "bus": { "price": "", "time": "", "booking": "" }
}

Rules:
If flight not available → write "Not Available"
If train not available → write "Not Available"
Bus usually available.
Keep answers short.
`;

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openrouter/auto",
        messages:[{ role:"user", content: prompt }]
      },
      {
        headers:{
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type":"application/json"
        }
      }
    );

    let text = response.data.choices[0].message.content;

    // remove markdown if AI adds ```
    text = text.replace(/```json|```/g,"").trim();

    res.json({ result: text });

  }catch(err){
    console.log("AI error:", err.response?.data || err.message);
    res.json({ result:"AI error. Try again." });
  }

});


// start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
  console.log("Server running...");
});