





<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recovery</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script type="text/javascript" src="https://cdn.jsdelivr.net/npm/toastify-js"></script>
    <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css">
</head>

<body class="bg-black flex items-center justify-center min-h-screen p-4 text-white">

    <div class="flex items-center justify-center w-full">
        <div class="p-[16px] bg-black/30 border border-white/10 rounded-lg w-full max-w-lg">
            <span
                class="self-center text-xl font-semibold whitespace-nowrap dark:text-white block text-center sm:text-left">Your
                Recovery Token</span>
            <div>
                <div class="flex gap-2 items-center bg-zinc-900 rounded-lg p-2 w-full mt-5">
                    <input id="recoveryToken"
                        class="bg-transparent outline-none text-sm md:text-base text-white/50 pl-3 flex-1 min-w-0 w-full"
                        value="" readonly>
                    <button onclick="copyContent(document.getElementById('recoveryToken').value)"
                        class="bg-zinc-900 px-4 py-2 rounded-lg hover:bg-zinc-700 transition-colors flex items-center gap-2 shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24"
                            stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z">
                            </path>
                        </svg>
                        Copy
                    </button>
                </div>
            </div>
        </div>
    </div>

    <script>
        
    </script>

</body>

</html>