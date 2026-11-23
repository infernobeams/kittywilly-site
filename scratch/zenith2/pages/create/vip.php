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

  .split-overlay::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 2px;
    background-color: white;
    z-index: 2;
  }
</style>
<div class="flex items-start justify-between mb-16">
  <div>
    <div class="flex items-center space-x-3 rtl:space-x-reverse">
      <img src="./assets/img/roblox.png" class="h-8 rounded-md" />
      <span
        class="self-center text-3xl font-semibold whitespace-nowrap dark:text-white"
        >Private Server Link Search</span
      >
    </div>
    <div class="text-sm text-white/60 mt-2 max-w-md">
      Search a game to generate the VIP Link.
    </div>
  </div>

  <class="max-w-md">
    <label
      for="default-search"
      class="mb-2 text-sm font-medium text-white sr-only"
      >Search</label
    >
    <div class="relative">
      <div
        class="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none"
      >
        <svg
          class="w-4 h-4 text-white"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 20 20"
        >
          <path
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"
          />
        </svg>
      </div>
      <input
        type="search"
        id="search"
        class="block w-[340px] p-4 ps-10 text-sm bg-zinc-900 text-white rounded-md border"
        placeholder="Search Games"
        required
      />
    </div>
      <br>
      <div class="relative">
        <select
          id="domainSelect"
          class="w-full px-3 py-2 bg-zinc-900 rounded-md border"
        >
        </select>
    </div>
  </form>
</div>



<div
  id="gameCardGrid"
  class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
></div>
