const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://lievjhktyxytznjxakbt.supabase.co";
const supabaseKey = "sb_publishable_SpwefIoCoUwu69WRc0Otdw__MeXsfuv";
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .limit(1);

  if (error) {
    console.error(error);
    return;
  }

  console.log("Raw Trip columns:", Object.keys(data[0] || {}));
  console.log("Full Trip Record:", data[0]);
}

main().catch(console.error);
