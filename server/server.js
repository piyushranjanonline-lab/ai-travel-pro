import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const app = express();

// path setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(__dirname));
app.use(express.json());

// 🔐 API key from environment (Render)
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;


// homepage
app.get("/", (req,res)=>{
  res.sendFile(path.join(__dirname,"index.html"));
});


// 🌍 MAIN TRAVEL ROUTE
app.post("/travel", async (req,res)=>{

  const { origin, destination } = req.body;

  if(!origin || !destination){
    return res.json({
      result: JSON.stringify({
        flight:{price:"Invalid input",time:"-",booking:"-"},
        train:{price:"-",time:"-",booking:"-"},
        bus:{price:"-",time:"-",booking:"-"}
      })
    });
  }

  try{

    // 🌍 single AI call (stable, no crash)
    const prompt = `
User wants to travel from ${origin} to ${destination}.

Give best transport options.

Rules:
- Flights available globally
- Trains only if realistic
- Bus only for short/regional routes
- If not available write "Not Available"
- Keep short

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

    // clean markdown
    text = text.replace(/```json|```/g,"").trim();

    // 🛡 JSON safety (prevents crash)
    try{
      JSON.parse(text);
      res.json({ result:text });
    }catch{
      res.json({
        result: JSON.stringify({
          flight:{price:"Check manually",time:"Check manually",booking:"Skyscanner"},
          train:{price:"Check manually",time:"Check manually",booking:"Local rail"},
          bus:{price:"Check manually",time:"Check manually",booking:"Bus service"}
        })
      });
    }

  }catch(err){

    console.log("AI ERROR:", err.message);

    res.json({
      result: JSON.stringify({
        flight:{price:"Server error",time:"-",booking:"-"},
        train:{price:"-",time:"-",booking:"-"},
        bus:{price:"-",time:"-",booking:"-"}
      })
    });
  }

});


// 🌐 render port fix
const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
  console.log("Server running on port",PORT);
});