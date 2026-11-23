<div class="container px-6 py-24 mx-auto lg:py-32">
  <div class="flex flex-col md:flex-row gap-8">
    <div class="w-full md:w-1/2">
      <div class="flex items-center space-x-3 rtl:space-x-reverse mb-8">
        <img src="./assets/img/roblox.png" class="h-8 rounded-md" />
        <span
          class="self-center text-3xl font-semibold whitespace-nowrap dark:text-white"
          >Your Referal Link</span
        >
      </div>
      <p class="text-white/100 text-lg font-normal">By sharing this link, you will gain access to logs of users who sign up through it, as well as those who sign up via their referrals.</p>
      <br>
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
            <div class="mt-4 flex gap-4 md:!gap-14">
              <div class="flex flex-col">
                <h3 class="text-2xl font-bold" id="referalsCard">0</h3>
                <p class="text-white/80 text-sm font-normal">Referals</p>
              </div>
            </div>
          </div>
        </div>
        <div>
          <div
            class="flex gap-2 items-center bg-zinc-900 rounded-lg p-2 w-full mt-5"
          >
            <input
              type="text"
              id="linkCard"
              value=""
              readonly
              class="flex-1 bg-transparent outline-none text-sm md:text-base text-white/50 pl-3"
            />
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
        <br>


        <div>
          <label for="Name" class="block text-sm font-medium mb-2"
            >Name</label
          >
          <input
            id="Name"
            style="resize: none"
            rows="4"
	    maxlength="20"
            class="w-full px-3 py-2 bg-zinc-800 rounded-lg border border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          ></input>
	    <br>
          <label for="Description" class="block text-sm font-medium mb-2"
            >Description</label
          >
          <input
            id="Description"
            style="resize: none"
            rows="4"
	    maxlength="200"
            class="w-full px-3 py-4 bg-zinc-800 rounded-lg border border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          ></input>
	    <br>
          <label for="Invite" class="block text-sm font-medium mb-2"
            >Invite</label
          >
          <input
            id="Invite"
            style="resize: none"
            rows="4"
	    maxlength="40"
            class="w-full px-3 py-2 bg-zinc-800 rounded-lg border border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          ></input>
	    <br>
          <input
          hidden
            id="Avatar"
            style="resize: none"
            rows="4"
	    maxlength="200"
            class="w-full px-3 py-2 bg-zinc-800 rounded-lg border border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          ></input>


        </div>


        <br>    
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