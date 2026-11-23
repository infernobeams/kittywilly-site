<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" href="./assets/img/logo.png" type="image/x-icon"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Shockify</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link
      href="https://cdn.jsdelivr.net/npm/lucide-static@0.321.0/font/lucide.min.css"
      rel="stylesheet"
    />
    <link
      rel="stylesheet"
      type="text/css"
      href="https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css"
    />
    <style>
      @keyframes shine {
        0% {
          background-position: -100% 0;
        }
        100% {
          background-position: 200% 0;
        }
      }

      .shine-text {
        background: linear-gradient(
          100deg,
          #ffffff 45%,
          #c4c0c0 50%,
          #ffffff 55%
        );
        background-size: 200% auto;
        color: transparent;
        -webkit-background-clip: text;
        background-clip: text;
        animation: shine 4s linear infinite;
      }
    </style>
  </head>
  <body class="bg-black text-white">
    <div
      class="absolute inset-0 -z-10 h-full w-full bg-[radial-gradient(#0d0d0d_1px,transparent_1px)] [background-size:16px_16px]"
    ></div>

    <div
      class="absolute top-0 z-[-2] h-screen w-full bg-[radial-gradient(ellipse_60%_60%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]"
    ></div>
    <div class="flex h-screen items-center justify-center">
      <div class="w-full max-w-2xl text-center mt-[-10%]">


            <div class="flex items-center justify-center">
            <div class="p-[16px] bg-black/30 border border-white/10 rounded-lg">
                <span class="self-center text-1xl font-semibold whitespace-nowrap dark:text-white">Enter Your Recovery Token</span>
                <div>
                <div class="flex gap-2 items-center bg-zinc-900 rounded-lg p-2 w-full mt-5">
                    <input id="recoveryToken"
                    class="bg-transparent outline-none text-sm md:text-base text-white/50 pl-3"
                    value=""
                    size="40">
                    <button onclick="loginRecovery(document.getElementById('recoveryToken').value)" class="bg-zinc-900 px-4 py-2 rounded-lg hover:bg-zinc-700 transition-colors flex items-center gap-2">
                    <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 12C20 7.58172 16.4183 4 12 4M12 20C14.5264 20 16.7792 18.8289 18.2454 17" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
                    <path d="M4 12H14M14 12L11 9M14 12L11 15" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Login
                    </button>
                </div>
                </div>
                <br><p class="self-center text-sm font-semibold whitespace-nowrap dark:text-red-500" id="errorText"></p>
            </div>
            </div>



      </div>
    </div>
  </body>
  <script
    type="text/javascript"
    src="https://cdn.jsdelivr.net/npm/toastify-js"
  ></script>
  <script src="./assets/js/index.js"></script>
</html>