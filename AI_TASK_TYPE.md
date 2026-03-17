## What type of AI are we using in EventVista?

**Short answer for the prof**  
We are **not** using classic *classification* or *regression* here.  
EventVista uses **generative / structured planning AI** (a large language + vision model) to design room layouts and give recommendations.

---

### Why it’s not classification
- **Classification** = the model picks a label from a fixed set (e.g. “cat vs dog”, “spam vs not spam”).
- Our `/api/ai-visual-design` endpoint sends a **360° image + text** to a vision‑LLM (Llama 4 Scout) and gets back a **full furniture layout plan**:
  - Multiple items
  - Exact yaw/pitch coordinates
  - Quantities and reasoning text
- This is an **open‑ended structured output**, not “choose one label”, so it’s not a pure classification task.

### Why it’s not regression
- **Regression** = the model predicts a **single numeric value** (e.g. price, temperature, probability).
- In our case the model is **not** predicting one continuous variable; it is **generating a whole JSON object** with many fields (furniture types, positions, zones, reasoning).
- We *post‑process* some numbers (normalizing yaw/pitch), but the core AI task is not “fit a numeric function”, so it’s not standard regression.

### What it actually is
- We use a **multimodal LLM** (image + text) as a:
  - **Generative layout planner**: proposes furniture placements and design strategy.
  - **Structured generator**: outputs JSON with recommendations, not just free text.
  - **Advisory assistant**: in `/api/ai-recommend`, it generates textual advice and follow‑up questions.
- Technically this falls under **generative AI / conditional generation** with **structured prediction**, guided by a detailed system prompt and server‑side normalization.

---

### If the professor asks, you can say:
> “We aren’t doing classic machine‑learning classification or regression here.  
> Instead, we use a multimodal generative model (Llama 4 Scout via Groq) that takes a 360° room image plus context and **generates a full furniture layout plan in JSON**.  
> It’s a **generative / structured planning task**, not just picking a label or predicting a single number, and we then normalize its numeric outputs (coordinates, quantities) on the server.”

