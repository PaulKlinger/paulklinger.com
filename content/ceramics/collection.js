let data;

window.onload = () => {
  fetch("./data/data.json")
    .then((response) => response.json())
    .then((data_in) => {
      data = data_in;
      setup_buttons();
      setup_page_from_url();
    });
};

const setup_page_from_url = () => {
  const params = new URLSearchParams(window.location.search);
  setup_page(params.get("page"), params.get("work"), params.get("artist"));
};

const setup_page = (page, work, artist) => {
  if (page === "artists") {
    populate_artists();
  } else {
    populate_works();
  }
  if (artist !== null) {
    const elem = document.getElementById(`artist_${artist}`);
    elem.querySelector(".entry_main_img").onclick();
    setTimeout(() => {
      elem.scrollIntoView({
        behavior: "smooth",
        block: "start",
        inline: "center",
      });
    }, 250);
  }
  if (work !== null) {
    const elem = document.getElementById(`work_${work}`);
    elem.querySelector(".entry_main_img").onclick();
    setTimeout(() => {
      elem.scrollIntoView({
        behavior: "smooth",
        block: "start",
        inline: "center",
      });
    }, 250);
  }
};

const elem_from_string = (s) => {
  const parser = new DOMParser();
  return parser.parseFromString(s, "text/html").body.childNodes[0];
};

const set_params = (page, work, artist) => {
  const baseurl = window.location.href.split("?")[0];
  const params = new URLSearchParams(window.location.search);
  if (page === "works") {
    params.delete("page");
  } else if (page !== null) {
    params.set("page", page);
  }
  if (work === null) {
    params.delete("work");
  } else {
    params.set("work", work);
  }
  if (artist === null) {
    if (page === "artists" || params.get("page") !== "artists") {
      params.delete("artist");
    }
  } else {
    params.set("artist", artist);
  }
  if (params.size === 0) {
    history.replaceState(null, "", baseurl);
  } else {
    history.replaceState(null, "", `${baseurl}?${params.toString()}`);
  }
};

const setup_buttons = () => {
  document.getElementById("greet").onclick = () => {
    document.getElementById("greet").classList.toggle("collapsed");
  };
  document.getElementById("works_select").onclick = () => {
    populate_works();
    set_params("works", null, null);
  };

  document.getElementById("artists_select").onclick = () => {
    populate_artists();
    set_params("artists", null, null);
  };
};

const setup_360_vid = (work_elem, work, vid_url) => {
  // clone node to remove any potentially still active event listeners
  const vid_elem = work_elem.querySelector("video");
  const vid = vid_elem.cloneNode(true);
  vid_elem.replaceWith(vid);

  vid.last_updated = Date.now();
  vid.addEventListener(
    "pointerdown",
    (e) => {
      if (e.buttons & (1 === 1)) {
        vid.pause();
        vid.start_x = e.offsetX;
        vid.start_cur_time = vid.currentTime;
      }
      e.preventDefault();
      vid.parentElement.querySelector(".swipe_hint").classList.add("hide");
    },
    true,
  );
  vid.addEventListener(
    "pointermove",
    (e) => {
      // seek to new position if mouse/touch is pressed and
      // it's been at least 20ms since the last seek
      if (e.buttons & (1 === 1) && Date.now() - vid.last_updated > 20) {
        if (vid.start_cur_time === undefined) {
          // pointer down happened outside of video element
          vid.pause();
          vid.start_cur_time = vid.currentTime;
          vid.start_x = e.offsetX;
          vid.parentElement.querySelector(".swipe_hint").classList.add("hide");
          return;
        }
        if (!(vid.duration > 0)) {
          return;
        }
        // fraction of video element width that the pointer has moved since start of motion
        const fraction_moved = (e.offsetX - vid.start_x) / vid.offsetWidth;
        const new_time =
          (vid.start_cur_time + vid.duration * fraction_moved + vid.duration) %
          vid.duration;
        vid.currentTime = new_time;
        vid.last_updated = Date.now();
        e.preventDefault();
      }
    },
    true,
  );

  // preload the entire video. Otherwise seeking to absolute positions hangs in weird ways
  work.video_preload_abort = new AbortController();
  preloadVideo(
    vid_url,
    work.video_preload_abort,
    work_elem.querySelector(".video_icon_progress"),
  ).then((blobUrl) => {
    if (blobUrl) {
      // set the source to the preloaded data blob
      vid.src = blobUrl;
      vid.play().then(() => {
        work_elem
          .querySelector(".video_container")
          .classList.remove("invisible");
        work_elem.querySelector(".swipe_hint").classList.remove("hide");
      });
    }
  });
};

function abortVideoPreload(work) {
  if (work.video_preload_abort !== undefined) {
    work.video_preload_abort.abort();
    work.video_preload_abort = undefined;
  }
}

async function preloadVideo(videoUrl, abortController, progressElem) {
  try {
    // delay showing progress indicator to prevent flashes
    let show_progress_at = Date.now() + 200;

    // Fetch the video file as a Blob
    const response = await fetch(videoUrl, { signal: abortController.signal });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const content_length = response.headers.get("Content-Length");
    const stream = response.body.getReader();
    let bytes_so_far = 0;
    const chunks = [];
    for (;;) {
      const { done, value } = await stream.read();
      bytes_so_far += value ? value.length : 0;
      const progress = done ? 100 : bytes_so_far / content_length;
      progressElem.style.setProperty("--angle", `${progress * 360}deg`);
      if (Date.now() > show_progress_at) {
        progressElem.classList.remove("hide");
        show_progress_at = Number.MAX_VALUE;
      }

      if (done) break;
      chunks.push(value);
    }

    const videoBlob = new Blob(chunks, { type: "video/mp4" });

    // wrap it in a blob URL
    const videoBlobUrl = URL.createObjectURL(videoBlob);

    return videoBlobUrl;
  } catch (error) {
    console.error(`Failed to preload video "${videoUrl}": ${error}`);
    return null;
  }
}

const create_work_elem = (work, artist) => {
  let work_thumbnails_html = "";

  // create thumbnail imgs
  for (const [i, img] of work.media.entries()) {
    work_thumbnails_html += `
      <div id="work_${work.id}_thumb_bar_img_${i}" class="entry_thumb_bar_entry">
        <img src="${img.thumb_path}" />
      </div>
    `;
  }

  // create main element
  const work_elem = elem_from_string(
    `
    <div class="entry_thumb work" id="work_${work.id}">
      <div class="close hide only_full">×</div>
      <div class="entry_info hide only_full">
        <div class="work_artist">
          <img src="${artist.img}"/>
        </div>
        <div class="work_details">
          <p class="work_head">
            <span class="work_title">${work.title}${work.year ? "," : ""}</span>
            <span class="work_year">${work.year}</span>
          </p>
          <p class="work_artist_name">${artist.name}</p>
          <p class="work_other">
            <span class="work_other_fieldname">acquired:</span>
            ${work.acquired}
            <br />
            <span class="work_other_fieldname">from:</span>
            ${work["bought where"]}
            <br />
            <span class="work_measurements">
              ${work["w [cm]"]}×${work["d [cm]"]}×${work["h [cm]"]}cm${
                work["dimensions suffix"] ? "&nbsp;" : ""
              }${work["dimensions suffix"]},
              ${work["weight [g]"]}g${work["weight suffix"] ? "&nbsp;" : ""}${
                work["weight suffix"]
              }
            </span>
          </p>
        </div>
      </div>
      <span class="loader only_full hide"></span>
      <div class="video_icon_progress only_full hide" id="video_icon_progress_${
        work.id
      }">
          <img />
      </div>
      <img src="${work.media[0].thumb_path}" class="entry_main_img entry_main">
      <div class="video_container entry_main hide">
          <video src="" loop autoplay muted playsinline></video>
          <span class="swipe_hint hide"></span>
      </div>
      <div class="entry_thumbnails_bar hide only_full">
        ${work_thumbnails_html}
      </div>
    </div>
  `,
  );

  // add click handler for artist (switch to artist page and expand matching)
  const open_artist = () => {
    set_params("artists", null, artist.artist_id);
    setup_page("artists", null, artist.artist_id);
  };
  work_elem.querySelector(".work_artist").onclick = open_artist;
  work_elem.querySelector(".work_artist_name").onclick = open_artist;

  const vid_progress = work_elem.querySelector(".video_icon_progress");
  const vid_container = work_elem.querySelector(".video_container");

  // add click handler for thumbnail images
  for (const [i, img] of work.media.entries()) {
    work_elem.querySelector(`#work_${work.id}_thumb_bar_img_${i}`).onclick =
      () => {
        abortVideoPreload(work);
        work_elem.querySelector(".swipe_hint").classList.add("hide");
        vid_progress.classList.add("hide");
        vid_container.classList.add("invisible");

        if (img.type === "vid") {
          work_elem.querySelector(".entry_main_img").classList.add("hide");
          vid_container.classList.remove("hide");

          // set current videos thumbnail in the loading icon
          vid_progress.querySelector("img").src = img.thumb_path;

          setup_360_vid(work_elem, work, img.full_path);
        } else {
          vid_container.classList.add("hide");
          work_elem.querySelector(".entry_main_img").classList.remove("hide");
          work_elem
            .querySelector(".entry_main_img")
            .setAttribute("src", img.full_path);
        }
      };
  }

  // add click handler for close button
  work_elem.querySelector(".close").onclick = () => {
    set_params(null, null, null);
    work_elem.querySelector(".entry_main_img").classList.remove("hide");
    work_elem.querySelector(".video_container").classList.add("hide");
    work_elem.classList.replace("entry_full", "entry_thumb");
    work_elem
      .querySelectorAll(".only_full")
      .forEach((n) => n.classList.add("hide"));
    work_elem
      .querySelector(".entry_main_img")
      .setAttribute("src", work.media[0].thumb_path);
  };

  // add click handler for opening work
  work_elem.querySelector(".entry_main_img").onclick = () => {
    set_params(null, work.id, null);
    if (work_elem.classList.contains("entry_thumb")) {
      work_elem.classList.replace("entry_thumb", "entry_full");
      work_elem
        .querySelector(".entry_main_img")
        .setAttribute("src", work.media[0].full_path);
      work_elem
        .querySelectorAll(".only_full")
        .forEach((n) => n.classList.remove("hide"));
    }
  };
  return work_elem;
};

const populate_works = () => {
  const works_elem = document.getElementById("main_list");
  works_elem.innerHTML = "";
  for (const work of Object.values(data.works)) {
    works_elem.append(create_work_elem(work, data.artists[work.artist_id]));
  }
};

const create_artist_elem = (artist, works) => {
  // create country string, depending on whether artist lives in
  // their country of birth
  let artist_country_str;
  if (artist.residence !== artist.origin) {
    artist_country_str = `${artist.residence} | ${artist.origin}`;
  } else {
    artist_country_str = artist.origin;
  }

  // create links
  let artist_links = "";
  if (artist.website !== "") {
    artist_links += `<p class="artist_link"><a href="${artist.website}">website</a></p>`;
  }
  if (artist.instagram !== "") {
    const instagram_link = `https://www.instagram.com/${artist.instagram.slice(
      1,
    )}/`;
    artist_links += `<p class="artist_link"><a href="${instagram_link}">instagram</a></p>`;
  }

  let artist_blurb_div = "";
  if (artist.web_blurb !== "") {
    artist_blurb_div = `
      <div class="artist_blurb hide only_full">
        ${artist.web_blurb}
      </div>
    `;
  }
  let artist_name_str = artist.name;
  if (artist.orig_name) {
    const artist_names_raw = `${artist.name} | ${artist.orig_name}`;
    artist_name_str = "";
    // only allow linebreaks between space-separated parts
    // (otherwise for asian languages line breaks are added in the middle)
    for (const name_part of artist_names_raw.split(" ")) {
      artist_name_str += `<span class="name_part">${name_part}</span> `;
    }
  }
  // create main element
  const artist_elem = elem_from_string(`
    <div class="entry_thumb artist" id="artist_${artist.artist_id}">
      <div class="artist_non_work collapsed">
        <div class="close hide only_full">×</div>
        <div class="artist_img_container">
          <img src="${artist.img}" class="entry_main_img entry_main" />
        </div>
        <div class="artist_details hide only_full">
          <p class="artist_name">${artist_name_str}</p>
          <p class="artist_country">${artist_country_str}</p>
          ${artist_links}
        </div>
        ${artist_blurb_div}
      </div>
      <div class="artist_works_list hide only_full">
      </div>
    </div>
  `);

  // add works
  for (const work of works) {
    artist_elem
      .querySelector(".artist_works_list")
      .append(create_work_elem(work, artist));
  }

  if (artist.web_blurb !== "") {
    artist_elem.querySelector(".artist_blurb").onclick = () => {
      artist_elem
        .querySelector(".artist_non_work")
        .classList.remove("collapsed");
    };
  }

  // add click handler for close button
  artist_elem.querySelector(".close").onclick = () => {
    set_params("artists", null, null);
    artist_elem.classList.replace("entry_full", "entry_thumb");
    artist_elem
      .querySelectorAll(".only_full")
      .forEach((n) => n.classList.add("hide"));

    artist_elem.querySelector(".artist_non_work").classList.add("collapsed");
    for (const work_close_button of artist_elem.querySelectorAll(
      ".artist_works_list .close",
    )) {
      work_close_button.onclick();
    }
  };

  // add click handler for opening artist
  artist_elem.querySelector(".entry_main_img").onclick = () => {
    set_params("artists", null, artist.artist_id);
    if (artist_elem.classList.contains("entry_thumb")) {
      artist_elem.classList.replace("entry_thumb", "entry_full");
      artist_elem.querySelectorAll(".only_full").forEach((n) =>
        // don't expand works
        n.matches(".work .only_full") ? null : n.classList.remove("hide"),
      );
    }
  };
  return artist_elem;
};

const populate_artists = () => {
  const artists_elem = document.getElementById("main_list");
  artists_elem.innerHTML = "";
  for (const [artist_id, artist] of Object.entries(data.artists)) {
    artists_elem.append(
      create_artist_elem(
        artist,
        Object.values(data.works).filter((w) => w.artist_id === artist_id),
      ),
    );
  }
};
