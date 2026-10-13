<script>
  import { setWindow } from "./windows.svelte.js";

  // the _ □ ✕ cluster, wired to the section's window state. the state
  // lives in the config, so a closed section comes back from settings.cfg.
  let { id } = $props();
</script>

<span class="winbtns">
  <button
    onclick={() => setWindow(id, "min")}
    title="reduce to the bar"
    aria-label="reduce">_</button
  >
  <button
    onclick={() => setWindow(id, "open")}
    title="restore"
    aria-label="restore">□</button
  >
  <button
    class="winbtns__x"
    onclick={() => setWindow(id, "closed")}
    title="close — bring it back from settings.cfg"
    aria-label="close">✕</button
  >
</span>
