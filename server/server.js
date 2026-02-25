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

  try{

    // 🌍 Step 1 — Ask AI to detect country
    const detectPrompt = `
Identify the country of these two cities:

Origin: ${origin}
Destination: ${destination}

Return ONLY JSON:
{
  "origin_country": "",
  "destination_country": ""
}
`;

    const detectResponse = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model:"openrouter/auto",
        messages:[{role:"user",content:detectPrompt}]
      },
      {
        headers:{
          "Authorization":`Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type":"application/json"
        }
      }
    );

    let detectText = detectResponse.data.choices[0].message.content;
    detectText = detectText.replace(/```json|```/g,"").trim();

    let countryData = JSON.parse(detectText);

    const internationalRoute =
      countryData.origin_country !== countryData.destination_country;

    // 🌍 Step 2 — Generate travel intelligence

    const prompt = `
User wants to travel from ${origin} (${countryData.origin_country})
to ${destination} (${countryData.destination_country})

Route type: ${internationalRoute ? "International" : "Domestic"}

Rules:
- Flights usually available globally
- Trains only if cities connected by rail
- Bus only for regional travel
- If not available write "Not Available"
- Keep answer short

Return ONLY JSON:
{
 "flight": { "price": "", "time": "", "booking": "" },
 "train": { "price": "", "time": "", "booking": "" },
 "bus": { "price": "", "time": "", "booking": "" }
}
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
    text = text.replace(/```json|```/g,"").trim();

    // JSON protection
    try{
      JSON.parse(text);
      res.json({ result:text });
    }catch{
      res.json({
        result: JSON.stringify({
          flight:{price:"Check manually",time:"Check manually",booking:"Skyscanner"},
          train:{price:"Check manually",time:"Check manually",booking:"Local rail site"},
          bus:{price:"Check manually",time:"Check manually",booking:"Regional bus service"}
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