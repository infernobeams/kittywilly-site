<?php
require_once($_SERVER["DOCUMENT_ROOT"] . "/setup.php");
require_once($_SERVER["DOCUMENT_ROOT"] . "/function.php");

$info = null;
$token = isset($_COOKIE["Authentication"]) ? $_COOKIE["Authentication"] : null;
if ($token)
{
    $info = get_user_by_recovery_token($token);
    if (!isset($info["discord_webhook"]))
    {
        die(header("Location: /discord.php?logout=1"));
    };
} 
else
{
    die(header("Location: /discord.php?logout=1"));
};

$ch = curl_init("https://discord.com/api/users/@me");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => ["Authorization: Bearer " . $info["discord_access_token"]],
]);
$user = json_decode(curl_exec($ch), true);
curl_close($ch);

$avatar_url = "https://cdn.discordapp.com/avatars/" . $user["id"] . "/" . $user["avatar"] . ".png?size=256";
update_last_active($info["id"]);
$_SESSION["info"] = $info;
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="icon" href="<?=$site["Info"]["Thumbnail"];?>" type="image/x-icon" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title><?=$site["Info"]["Name"];?></title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/lucide-static@0.321.0/font/lucide.min.css" rel="stylesheet" />
  <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css" />
  <script src="https://cdn.jsdelivr.net/npm/dompurify@2.4.0/dist/purify.min.js"></script>
  <style>
    /* Hide default arrows for number inputs */
    input[type="number"]::-webkit-inner-spin-button,
    input[type="number"]::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    input[type="number"] {
      -moz-appearance: textfield;
    }

    /* Custom Scrollbar for Webkit */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    ::-webkit-scrollbar-track {
      background: #09090b;
    }

    ::-webkit-scrollbar-thumb {
      background: #3f3f46;
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: #52525b;
    }

    #live-chat-div::-webkit-scrollbar {
      display: none;
    }

    #live-chat-div {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
  </style>
</head>

<body class="bg-black text-white">
  <div
    class="absolute inset-0 -z-10 h-full w-full bg-[radial-gradient(#0d0d0d_1px,transparent_1px)] [background-size:16px_16px]">
  </div>

  <div
    class="absolute top-0 z-[-2] h-screen w-full bg-[radial-gradient(ellipse_60%_60%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]">
  </div>
  <div class="flex h-screen">
    <!-- Sidebar -->
    <!-- Sidebar -->
    <div id="left-sidebar"
      class="bg-black w-64 border-r border-white/10 p-4 flex flex-col fixed inset-y-0 left-0 z-50 transition-transform duration-300 -translate-x-full md:translate-x-0 md:static md:inset-auto overflow-y-auto">
      <div class="mb-3">
        <div class="flex items-center space-x-3 rtl:space-x-reverse p-1 pb-4">
          <img src="<?=$site["Info"]["Thumbnail"];?>" class="h-8 rounded-md" />
          <span class="self-center text-2xl font-semibold whitespace-nowrap dark:text-white"><?=$site["Info"]["Name"];?></span>
        </div>
      </div>
      <nav class="space-y-2 mb-auto">
        <hr class="border-t border-gray-200 dark:border-gray-700" />
        <div>
          <div onclick="loadSubpage('dashboard')" style="cursor: pointer"
            class="flex items-center p-2 text-white-900 rounded-lg dark:text-white dark:hover:bg-white/10 group">
            <svg class="flex-shrink-0 w-5 h-5 transition duration-75 text-gray-400 dark:group-hover:text-white"
              aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 18 18">
              <path
                d="M6.143 0H1.857A1.857 1.857 0 0 0 0 1.857v4.286C0 7.169.831 8 1.857 8h4.286A1.857 1.857 0 0 0 8 6.143V1.857A1.857 1.857 0 0 0 6.143 0Zm10 0h-4.286A1.857 1.857 0 0 0 10 1.857v4.286C10 7.169 10.831 8 11.857 8h4.286A1.857 1.857 0 0 0 18 6.143V1.857A1.857 1.857 0 0 0 16.143 0Zm-10 10H1.857A1.857 1.857 0 0 0 0 11.857v4.286C0 17.169.831 18 1.857 18h4.286A1.857 1.857 0 0 0 8 16.143v-4.286A1.857 1.857 0 0 0 6.143 10Zm10 0h-4.286A1.857 1.857 0 0 0 10 11.857v4.286c0 1.026.831 1.857 1.857 1.857h4.286A1.857 1.857 0 0 0 18 16.143v-4.286A1.857 1.857 0 0 0 16.143 10Z" />
            </svg>
            <span class="flex-1 ms-3 whitespace-nowrap">Dashboard</span>
          </div>
        </div>


        <div>
          <div onclick="loadSubpage('/misc/links')" style="cursor: pointer"
            class="flex items-center p-2 text-white-900 rounded-lg dark:text-white dark:hover:bg-white/10 group">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
              stroke="currentColor"
              class="flex-shrink-0 w-5 h-5 text-gray-500 transition duration-75 dark:text-gray-400 group-hover:text-white-900 dark:group-hover:text-white">

              <path
                d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
            </svg>


            <span class="flex-1 ms-3 whitespace-nowrap">All Sites</span>
          </div>
        </div>

        <div>
          <div onclick="loadSubpage('logs')" style="cursor: pointer"
            class="flex items-center p-2 text-white-900 rounded-lg dark:text-white dark:hover:bg-white/10 group">
            <svg
              class="flex-shrink-0 w-5 h-5 text-gray-500 transition duration-75 dark:text-gray-400 group-hover:text-white-900 dark:group-hover:text-white"
              aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 18">
              <path
                d="M14 2a3.963 3.963 0 0 0-1.4.267 6.439 6.439 0 0 1-1.331 6.638A4 4 0 1 0 14 2Zm1 9h-1.264A6.957 6.957 0 0 1 15 15v2a2.97 2.97 0 0 1-.184 1H19a1 1 0 0 0 1-1v-1a5.006 5.006 0 0 0-5-5ZM6.5 9a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM8 10H5a5.006 5.006 0 0 0-5 5v2a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-2a5.006 5.006 0 0 0-5-5Z" />
            </svg>
            <span class="flex-1 ms-3 whitespace-nowrap">Logs</span>

            <span class="bg-blue-900 text-blue-300 bg-opacity-50 px-2 py-1 rounded-full text-xs"
              id="logs-amount-sidebar"><?=$info["statistics_accounts"];?></span>
          </div>
        </div>
        <div>
          <div onclick="loadSubpage('visits')" style="cursor: pointer"
            class="flex items-center p-2 text-white-900 rounded-lg dark:text-white dark:hover:bg-white/10 group">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
              stroke="currentColor"
              class="flex-shrink-0 w-5 h-5 text-gray-500 transition duration-75 dark:text-gray-400 group-hover:text-white-900 dark:group-hover:text-white">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>

            <span class="flex-1 ms-3 whitespace-nowrap">Visits</span>

            <span
class="bg-blue-900 text-blue-300 bg-opacity-50 px-2 py-1
rounded-full text-xs"
id="logs-amount-sidebar"
><?=$info["statistics_visits"];?></span>
          </div>
        </div>

        <div>
          <div onclick="loadSubpage('settings')" style="cursor: pointer"
            class="flex items-center p-2 text-white-900 rounded-lg dark:text-white dark:hover:bg-white/10 group">
            <svg
              class="flex-shrink-0 w-5 h-5 text-gray-500 transition duration-75 dark:text-gray-400 group-hover:text-white-900 dark:group-hover:text-white"
              aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24">
              <path
                d="m2.344 15.271 2 3.46a1 1 0 0 0 1.366.365l1.396-.806c.58.457 1.221.832 1.895 1.112V21a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-1.598a8.094 8.094 0 0 0 1.895-1.112l1.396.806c.477.275 1.091.11 1.366-.365l2-3.46a1.004 1.004 0 0 0-.365-1.366l-1.372-.793a7.683 7.683 0 0 0-.002-2.224l1.372-.793c.476-.275.641-.89.365-1.366l-2-3.46a1 1 0 0 0-1.366-.365l-1.396.806A8.034 8.034 0 0 0 15 4.598V3a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v1.598A8.094 8.094 0 0 0 7.105 5.71L5.71 4.904a.999.999 0 0 0-1.366.365l-2 3.46a1.004 1.004 0 0 0 .365 1.366l1.372.793a7.683 7.683 0 0 0 0 2.224l-1.372.793c-.476.275-.641.89-.365 1.366zM12 8c2.206 0 4 1.794 4 4s-1.794 4-4 4-4-1.794-4-4 1.794-4 4-4z">
              </path>
            </svg>

            <span class="flex-1 ms-3 whitespace-nowrap">Settings</span>
          </div>

          <div class="pt-7">
            <p class="font-semibold pb-2">Create a Phishing Page</p>
            <hr class="space-y-2 border-t border-gray-200 dark:border-gray-700" />
          </div>

          <div>
            <div onclick="loadSubpage('/create/profile')" style="cursor: pointer"
              class="flex items-center p-2 text-white-900 rounded-lg dark:text-white dark:hover:bg-white/10 group">
              <svg
                class="flex-shrink-0 w-5 h-5 text-gray-500 transition duration-75 dark:text-gray-400 group-hover:text-white-900 dark:group-hover:text-white"
                aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 18">
                <path
                  d="M14 2a3.963 3.963 0 0 0-1.4.267 6.439 6.439 0 0 1-1.331 6.638A4 4 0 1 0 14 2Zm1 9h-1.264A6.957 6.957 0 0 1 15 15v2a2.97 2.97 0 0 1-.184 1H19a1 1 0 0 0 1-1v-1a5.006 5.006 0 0 0-5-5ZM6.5 9a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM8 10H5a5.006 5.006 0 0 0-5 5v2a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-2a5.006 5.006 0 0 0-5-5Z" />
              </svg>
              <span class="flex-1 ms-3 whitespace-nowrap">Profile</span>
            </div>
          </div>
          <div>
            <div onclick="loadSubpage('/create/group')" style="cursor: pointer"
              class="flex items-center p-2 text-white-900 rounded-lg dark:text-white dark:hover:bg-white/10 group">
              <svg
                class="flex-shrink-0 w-5 h-5 text-gray-500 transition duration-75 dark:text-gray-400 group-hover:text-white-900 dark:group-hover:text-white"
                aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 18">
                <path
                  d="M14 2a3.963 3.963 0 0 0-1.4.267 6.439 6.439 0 0 1-1.331 6.638A4 4 0 1 0 14 2Zm1 9h-1.264A6.957 6.957 0 0 1 15 15v2a2.97 2.97 0 0 1-.184 1H19a1 1 0 0 0 1-1v-1a5.006 5.006 0 0 0-5-5ZM6.5 9a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM8 10H5a5.006 5.006 0 0 0-5 5v2a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-2a5.006 5.006 0 0 0-5-5Z" />
              </svg>
              <span class="flex-1 ms-3 whitespace-nowrap">Group</span>
            </div>
          </div>
          <div>
            <div onclick="loadSubpage('/create/vip')" style="cursor: pointer"
              class="flex items-center p-2 text-white-900 rounded-lg dark:text-white dark:hover:bg-white/10 group">
              <svg
                class="flex-shrink-0 w-5 h-5 text-gray-500 transition duration-75 dark:text-gray-400 group-hover:text-white-900 dark:group-hover:text-white"
                aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 18">
                <path
                  d="M14 2a3.963 3.963 0 0 0-1.4.267 6.439 6.439 0 0 1-1.331 6.638A4 4 0 1 0 14 2Zm1 9h-1.264A6.957 6.957 0 0 1 15 15v2a2.97 2.97 0 0 1-.184 1H19a1 1 0 0 0 1-1v-1a5.006 5.006 0 0 0-5-5ZM6.5 9a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM8 10H5a5.006 5.006 0 0 0-5 5v2a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-2a5.006 5.006 0 0 0-5-5Z" />
              </svg>
              <span class="flex-1 ms-3 whitespace-nowrap">VIP Server</span>
            </div>
          </div>

          <div class="pt-7">
            <p class="font-semibold pb-2">Miscellaneous</p>
            <hr class="space-y-2 border-t border-gray-200 dark:border-gray-700" />
          </div>

          <div>
            <div onclick="loadSubpage('/misc/refer')" style="cursor: pointer"
              class="flex items-center p-2 text-white-900 rounded-lg dark:text-white dark:hover:bg-white/10 group">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                stroke="currentColor"
                class="flex-shrink-0 w-5 h-5 text-gray-500 transition duration-75 dark:text-gray-400 group-hover:text-white-900 dark:group-hover:text-white">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
              </svg>


              <span class="flex-1 ms-3 whitespace-nowrap">Referral Link</span>
            </div>
          </div>

          <div>
            <div onclick="loadSubpage('/misc/hyperLink')" style="cursor: pointer"
              class="flex items-center p-2 text-white-900 rounded-lg dark:text-white dark:hover:bg-white/10 group">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                stroke="currentColor"
                class="flex-shrink-0 w-5 h-5 text-gray-500 transition duration-75 dark:text-gray-400 group-hover:text-white-900 dark:group-hover:text-white">

                <path
                  d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
              </svg>

              <span class="flex-1 ms-3 whitespace-nowrap">Hyperlink</span>
            </div>
          </div>

          <div>
            <div onclick="loadSubpage('/misc/cookieBypass')" style="cursor: pointer"
              class="flex items-center p-2 text-white-900 rounded-lg dark:text-white dark:hover:bg-white/10 group">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                stroke="currentColor"
                class="flex-shrink-0 w-5 h-5 text-gray-500 transition duration-75 dark:text-gray-400 group-hover:text-white-900 dark:group-hover:text-white">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>

              <span class="flex-1 ms-3 whitespace-nowrap">IPLockBypass</span>
            </div>
          </div>
          <div>
            <div onclick="loadSubpage('/misc/2FABypassers')" style="cursor: pointer"
              class="flex items-center p-2 text-white-900 rounded-lg dark:text-white dark:hover:bg-white/10 group">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                stroke="currentColor"
                class="flex-shrink-0 w-5 h-5 text-gray-500 transition duration-75 dark:text-gray-400 group-hover:text-white-900 dark:group-hover:text-white">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>

              <span class="flex-1 ms-3 whitespace-nowrap">Bypassers</span>
            </div>
          </div>
      <div id="Recovery" onclick="loadSubpage('/misc/recovery')" style="cursor: pointer">
        <div class="flex items-center p-2 text-white-900 rounded-lg dark:text-white dark:hover:bg-white/10 group">
          <svg
            class="flex-shrink-0 w-5 h-5 text-gray-500 transition duration-75 dark:text-gray-400 group-hover:text-white-900 dark:group-hover:text-white"
            aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 18 16">
            <path stroke="currentColor"
              d="M12.5 8.5V7.5C12.5 6.94772 12.0523 6.5 11.5 6.5H1.5C0.947715 6.5 0.5 6.94772 0.5 7.5V13.5C0.5 14.0523 0.947715 14.5 1.5 14.5H11.5C12.0523 14.5 12.5 14.0523 12.5 13.5V12.5M12.5 8.5H8.5C7.39543 8.5 6.5 9.39543 6.5 10.5C6.5 11.6046 7.39543 12.5 8.5 12.5H12.5M12.5 8.5C13.6046 8.5 14.5 9.39543 14.5 10.5C14.5 11.6046 13.6046 12.5 12.5 12.5M3.5 6.5V3.5C3.5 1.84315 4.84315 0.5 6.5 0.5C8.15685 0.5 9.5 1.84315 9.5 3.5V6.5M12 10.5H13M10 10.5H11M8 10.5H9" />
          </svg>
          <span class="flex-1 ms-3 whitespace-nowrap">Recovery</span>
        </div>
      </div>
      <div style="cursor: pointer" onclick="window.location.href='discord.php?logout=1'">
        <div class="flex items-center p-2 text-white-900 rounded-lg dark:text-white dark:hover:bg-white/10 group">
          <svg
            class="flex-shrink-0 w-5 h-5 text-gray-500 transition duration-75 dark:text-gray-400 group-hover:text-white-900 dark:group-hover:text-white"
            aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 18 16">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M1 8h11m0 0L8 4m4 4-4 4m4-11h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-3" />
          </svg>
          <span class="flex-1 ms-3 whitespace-nowrap">Log Out</span>
        </div>
      </div>
      </nav>
      <div id="dropdown-cta" class="p-4 mt-6 rounded-lg bg-indigo-500/30" role="alert">
        <div class="flex items-center mb-3">
          <span class="bg-blue-100 text-blue-800 text-sm font-semibold me-2 px-2.5 py-0.5 rounded">Socials</span>
        </div>
          
          <a
  class="text-sm text-indigo-500 underline font-medium hover:text-indigo-300"
  href="<?=$site["Discord"]["Invite"];?>"
>
  <?=str_replace("https://", "", $site["Discord"]["Invite"]);?></a>

      </div>

    </div>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Mobile Header -->
      <div
        class="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black sticky top-0 z-30">
        <button id="mobile-menu-btn" class="p-2 -ml-2 text-gray-400 hover:text-white transition-colors">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
        </button>

        <div class="flex items-center space-x-2">
          <img src="<?=$site["Info"]["Thumbnail"];?>" class="h-6 rounded-md" />
          <span class="font-semibold text-lg tracking-tight"><?=$site["Info"]["Name"];?></span>
        </div>

        <button id="mobile-chat-btn" class="p-2 -mr-2 text-gray-400 hover:text-white transition-colors">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z">
            </path>
          </svg>
        </button>
      </div>
      <!-- Content Area -->
      <div class="flex-1 p-4 overflow-auto">
        <div class="mx-auto px-4 md:px-10 pt-4 md:pt-11" id="content"></div>
      </div>
    </div>

    <div id="right-sidebar"
      class="w-96 flex flex-col bg-black fixed inset-y-0 right-0 z-50 transition-transform duration-300 translate-x-full lg:translate-x-0 lg:static lg:inset-auto overflow-y-auto">
      <div class="p-3 border-b border-white/10 mt-3">
        <div class="flex items-center space-x-3">
          <img src="<?=$avatar_url;?>"
            class="h-8 rounded-full">
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-bold truncate"><?=$info["discord_username"];?></h2>
              <div class="flex gap-1">
                <span class="px-1.5 py-0.5 text-xs rounded bg-indigo-500/20 text-indigo-300 font-medium">
                  Lvl  <?=$info["account_level"];?> </span>
                <span class="px-1.5 py-0.5 text-xs rounded bg-red-400/20 text-red-300 font-medium">
                  <?=$info["account_rank"];?> </span>
              </div>
            </div>
            <div class="w-full bg-gray-800/50 rounded-full h-1.5 mt-2">
              <div class="bg-indigo-500 h-1.5 rounded-full"
                  style="width: 0.1%"
                  role="progressbar"
                  aria-valuenow="1"
                  aria-valuemin="0"
                  aria-valuemax="1000">
              </div>
            </div>
          </div>
        </div>
        <div class="flex p-3 justify-end md:hidden">
          <button id="close-chat-btn" class="text-gray-400 hover:text-white">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>

      <div class="flex-1 p-4 overflow-auto" id="live-chat-div">
        <div class="space-y-4" id="live-chat">
        </div>
      </div>


      <div class="border-t border-white/10 p-4">
        <div class="flex items-center space-x-2">
          <div class="relative flex-1">
            <input
                type="text"
                id="message"
                class="w-full bg-zinc-950 border border-gray-700/50 rounded-lg py-2 px-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Message"
                
              />
          </div>
          <button id="send-message"
            class="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            <span class="sr-only">Send message</span>
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
  <div id="mobile-overlay"
    class="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 hidden md:hidden transition-opacity duration-300 opacity-0 pointer-events-none data-[state=open]:opacity-100 data-[state=open]:pointer-events-auto">
  </div>
</body>
<script type="text/javascript" src="https://cdn.jsdelivr.net/npm/toastify-js"></script>
  <script src="/assets/js/index.js"></script>
</html>