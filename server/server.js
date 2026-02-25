import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const app = express();

// path fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(__dirname));
app.use(express.json());

// 🔐 API key from Render environment
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;


// homepage
app.get("/", (req,res)=>{
  res.sendFile(path.join(__dirname,"index.html"));
});


// 🌍 MAIN ROUTE
app.post("/travel", async (req,res)=>{

  const { origin, destination } = req.body;

  if(!origin || !destination){
    return res.json({ result:"Invalid input" });
  }

  const from = origin.toLowerCase();
  const dest = destination.toLowerCase();

  let restrictionMessage = "";
  let internationalRoute = false;

  // 🌍 detect international
  const indianCities = [
    "delhi","mumbai","bangalore","kolkata","chennai",
    "hyderabad","pune","jaipur","ahmedabad","goa",
    "manali","shimla","lucknow"
  ];

  if(!indianCities.includes(from) || !indianCities.includes(dest)){
    internationalRoute = true;
  }

  // 🏔 hill stations (no flight/train both sides)
  const hillStations = [
    "manali","shimla","kasol","spiti","dharamshala","mussoorie"
  ];

  if(hillStations.includes(from) || hillStations.includes(dest)){
    restrictionMessage += "No direct flight or train available. Bus or car required. ";
  }

  // leh special
  if(from==="leh" || dest==="leh"){
    restrictionMessage += "Flight only option. No train available. ";
  }

  // short routes
  if((from==="delhi" && dest==="jaipur") || (from==="jaipur" && dest==="delhi")){
    restrictionMessage += "Very short distance. Flight not recommended. ";
  }

  if((from==="mumbai" && dest==="pune") || (from==="pune" && dest==="mumbai")){
    restrictionMessage += "Short distance route. Train or cab better. ";
  }

  // 🌍 international rules
  if(internationalRoute){
    restrictionMessage += `
This is an international route.
Flights are main option.
Trains only if both cities in same continent (Europe/Japan).
Bus only for nearby countries.
Mention passport and visa briefly.
Use Skyscanner, Google Flights, Expedia for booking.
`;
  }

  try{

    const prompt = `
User wants to travel from ${origin} to ${destination}.

Route type: ${internationalRoute ? "International" : "Domestic"}

Route intelligence:
${restrictionMessage}

Return ONLY JSON:
{
 "flight": { "price": "", "time": "", "booking": "" },
 "train": { "price": "", "time": "", "booking": "" },
 "bus": { "price": "", "time": "", "booking": "" }
}

Rules:
If transport not available → write "Not Available"
Keep answers short.
`;

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model:"openrouter/auto",
        messages:[{role:"user",content:prompt}]
      },
      {
        headers:{
          "Authorization":`Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type":"application/json"
        }
      }
    );

    let text = response.data.choices[0].message.content;

    // remove markdown if AI adds ```
    text = text.replace(/```json|```/g,"").trim();

    // 🛡 crash protection if bad JSON
    try{
      JSON.parse(text);
      res.json({ result:text });
    }catch{
      res.json({
        result: JSON.stringify({
          flight:{price:"Check manually",time:"Check manually",booking:"Skyscanner"},
          train:{price:"Check manually",time:"Check manually",booking:"RailEurope"},
          bus:{price:"Check manually",time:"Check manually",booking:"Bus services"}
        })
      });
    }

  }catch(err){
    console.log("AI error:",err.message);

    res.json({
      result: JSON.stringify({
        flight:{price:"Error",time:"Error",booking:"Error"},
        train:{price:"Error",time:"Error",booking:"Error"},
        bus:{price:"Error",time:"Error",booking:"Error"}
      })
    });
  }

});


// 🌐 cloud port
const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
  console.log("Server running...");
});