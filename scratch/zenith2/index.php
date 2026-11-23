<?php
require_once($_SERVER["DOCUMENT_ROOT"] . "/setup.php");
require_once($_SERVER["DOCUMENT_ROOT"] . "/function.php");
if (isset($_COOKIE["Authentication"])) {
    die(header("Location: /dashboard"));
};

if (isset($_GET["code"])) 
{
    $_SESSION["referral"] = $_GET["code"];
};

$total_users = 0;
try {
    $stmt = $db->query("SELECT COUNT(*) FROM users");
    $total_users = (int)$stmt->fetchColumn();
} catch (Exception $e) {
    $total_users = 0;
};
?>
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" href="./assets/img/logo.png" type="image/x-icon"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title><?=$site["Info"]["Name"];?></title>
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
        <div class="flex justify-center gap-16 mb-6">
          <div class="">
            <div class="text-4xl font-bold"><?=$total_users;?></div>
            <div class="text-sm text-white/80">Total Users</div>
          </div>
          <div class="">
            <div class="text-4xl font-bold">0</div>
            <div class="text-sm text-white/80">Total Hits</div>
          </div>
        </div>

        <h1 class="text-sm font-bold mb-2">
          <span>
<pre class="shine-text">
     _                _    _  __       
    | |              | |  (_)/ _|      
 ___| |__   ___   ___| | ___| |_ _   _ 
/ __| '_ \ / _ \ / __| |/ / |  _| | | |
\__ \ | | | (_) | (__|   <| | | | |_| |
|___/_| |_|\___/ \___|_|\_\_|_|  \__, |
                                  __/ |
                                 |___/ </pre>
          </span>
        </h1>

        <p class="text-sm text-white/60 mb-12">
          <?=$site["Info"]["Description"];?></p>


        <button onclick="window.location.href = '<?=$site["Discord"]["Oauth"]["URL"];?>'"
          type="button"
          class="text-gray-900 bg-gray-100 hover:bg-zinc-400 focus:ring-4 focus:outline-none focus:ring-gray-100 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center dark:focus:ring-gray-500 me-2 mb-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill="currentColor"
            class="mr-2"
            viewBox="0 0 16 16"
          >
            <path
              d="M13.545 2.907a13.2 13.2 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.2 12.2 0 0 0-3.658 0 8 8 0 0 0-.412-.833.05.05 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.04.04 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032q.003.022.021.037a13.3 13.3 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019q.463-.63.818-1.329a.05.05 0 0 0-.01-.059l-.018-.011a9 9 0 0 1-1.248-.595.05.05 0 0 1-.02-.066l.015-.019q.127-.095.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.05.05 0 0 1 .053.007q.121.1.248.195a.05.05 0 0 1-.004.085 8 8 0 0 1-1.249.594.05.05 0 0 0-.03.03.05.05 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.2 13.2 0 0 0 4.001-2.02.05.05 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.03.03 0 0 0-.02-.019m-8.198 7.307c-.789 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612m5.316 0c-.788 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612"
            />
          </svg>
          Login with Discord
        </button>
        <button onclick="window.location.href = 'recovery'"
          type="button"
          class="text-gray-100 bg-zinc-950 hover:bg-zinc-800 focus:ring-4 focus:outline-none focus:ring-gray-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center me-2 mb-2"
        >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.5 8.5V7.5C12.5 6.94772 12.0523 6.5 11.5 6.5H1.5C0.947715 6.5 0.5 6.94772 0.5 7.5V13.5C0.5 14.0523 0.947715 14.5 1.5 14.5H11.5C12.0523 14.5 12.5 14.0523 12.5 13.5V12.5M12.5 8.5H8.5C7.39543 8.5 6.5 9.39543 6.5 10.5C6.5 11.6046 7.39543 12.5 8.5 12.5H12.5M12.5 8.5C13.6046 8.5 14.5 9.39543 14.5 10.5C14.5 11.6046 13.6046 12.5 12.5 12.5M3.5 6.5V3.5C3.5 1.84315 4.84315 0.5 6.5 0.5C8.15685 0.5 9.5 1.84315 9.5 3.5V6.5M12 10.5H13M10 10.5H11M8 10.5H9" stroke="#ffffff"/>
        </svg>Login with Recovery
        </button>
      </div>
    </div>
  </body>
  <script
    type="text/javascript"
    src="https://cdn.jsdelivr.net/npm/toastify-js"
  ></script>
  <script src="./assets/js/index.js"></script>
</html>