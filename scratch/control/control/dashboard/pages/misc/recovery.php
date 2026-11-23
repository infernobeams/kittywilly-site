<div class="flex items-center justify-center">
  <div class="w-full max-w-lg">
    <div class="flex flex-col items-center text-center mb-8">
      <img src="./assets/img/logo.svg" class="h-8 rounded-md" alt="" />
      <span class="self-center text-3xl font-semibold whitespace-nowrap dark:text-white">Recovery Token</span>
    </div>
    <div class="p-4 bg-black/30 border border-white/10 rounded-lg w-full">
      <div class="flex gap-2 items-center bg-zinc-900 rounded-lg p-2 w-full">
        <input
          id="recoveryToken"
          class="bg-transparent outline-none text-sm md:text-base text-white/50 pl-3 flex-1 min-w-0 w-full"
          value=""
          readonly
        />
        <button
          type="button"
          id="recoveryCopyBtn"
          class="bg-zinc-900 px-4 py-2 rounded-lg hover:bg-zinc-700 transition-colors flex items-center gap-2 shrink-0"
        >
          Copy
        </button>
      </div>
    </div>
  </div>
</div>
