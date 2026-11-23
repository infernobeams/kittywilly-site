<html>
<head>
<link rel='stylesheet' href='https://cdn-uicons.flaticon.com/2.6.0/uicons-regular-rounded/css/uicons-regular-rounded.css'>
<link rel='stylesheet' href='https://cdn-uicons.flaticon.com/2.6.0/uicons-brands/css/uicons-brands.css'>
<style>
@import url('https://cdn-uicons.flaticon.com/2.6.0/uicons-regular-rounded/css/uicons-regular-rounded.css')
</style>
</head>
<body>
<div class="flex flex-col items-center text-center mb-8">
  <img src="./assets/img/logo.svg" class="h-8 rounded-md" />
  <span class="self-center text-3xl font-semibold whitespace-nowrap dark:text-white">
    Sites Page
  </span>
</div>

<p class="text-white/100 text-lg font-normal text-center mb-8">
  Use this page to view all of our "Roblox" links.
</p>
<div class="flex flex-wrap justify-center gap-8">

    <div class="w-full md:w-1/4">
      <div class="p-4 bg-black/30 border border-white/10 rounded-lg h-full">
        <div class="flex flex-col items-center text-center">
            <h3 class="font-bold text-white break-words text-center max-w-full leading-tight text-2xl">
            <?=$_SERVER[ "SERVER_NAME" ];?>
            </h3>
          <a href="https://<?=$_SERVER[ "SERVER_NAME" ];?>/dashboard" target="_blank" 
            class="text-blue-400 underline text-sm mt-2 break-words truncate max-w-full">
            Dashboard
          </a>
          <p class="text-green-400 font-semibold mt-2 text-sm break-words truncate max-w-full">
            Status: Online
          </p>
          <p class="text-red-400 font-semibold mt-2 text-sm break-words truncate max-w-full">
            Flag: <i class="fi fi-brands-tik-tok"></i> <i class="fi fi-brands-discord"></i>
          </p>
        </div>
      </div>
    </div>


<div class="w-full md:w-1/4">
  <div class="p-4 bg-black/30 border border-white/10 rounded-lg h-full">
    <div class="flex flex-col items-center text-center">
        <h3 class="font-bold text-white break-words text-center max-w-full leading-tight text-2xl">
        Socials
        </h3>
        <a href="https://discord.gg/smUmGmExX9" target="_blank" 
          class="text-blue-400 underline text-sm mt-2">
          Discord
        </a>
        <div class="flex items-center justify-center text-sm mt-2 text-blue-400 space-x-2">
          <a href="https://t.me/shockifyv5" target="_blank" class="underline">Telegram</a>
          <span>|</span>
          <a href="https://t.me/ShockifyCommunity" target="_blank" class="underline">Telegram Chat</a>
        </div>
        <p class="text-green-400 font-semibold mt-2 text-sm">
          Status: Online
        </p>
    </div>
  </div>
</div>
</div>
</body>
</html>