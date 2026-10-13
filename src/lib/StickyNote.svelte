<script>
  // the paper itself — a square of yellow, taped at the top, folded at the
  // corner. it is used twice: once to write a note on, and once to read a
  // note that found you. the writing surface is a textarea when editable
  // and plain text when not, so both views are the same piece of paper.
  let {
    value = $bindable(""),
    editable = false,
    placeholder = "",
    disabled = false,
    maxlength = undefined,
    label = "note",
    foot,
  } = $props();
</script>

<div class="pad">
  <span class="pad__tape" aria-hidden="true"></span>
  {#if editable}
    <textarea
      class="pad__area"
      bind:value
      {maxlength}
      {disabled}
      {placeholder}
      spellcheck="false"
      aria-label={label}></textarea>
  {:else}
    <p class="pad__text">{value}</p>
  {/if}
  {#if foot}
    <div class="pad__foot">{@render foot()}</div>
  {/if}
</div>

<style>
  .pad {
    position: relative;
    padding: 26px 22px 16px;
    background: linear-gradient(158deg, #fff7bd, #ffe27a 52%, #ffd24d);
    border-radius: 2px;
    transform: rotate(-1.1deg);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.7),
      0 20px 34px -20px rgba(0, 0, 0, 0.85),
      0 3px 8px -3px rgba(0, 0, 0, 0.5);
  }
  /* the folded corner */
  .pad::after {
    content: "";
    position: absolute;
    right: 0;
    bottom: 0;
    width: 26px;
    height: 26px;
    background: linear-gradient(135deg, #f7dd8a, #d9a92e);
    clip-path: polygon(100% 0, 100% 100%, 0 100%);
    box-shadow: -2px -2px 6px -2px rgba(0, 0, 0, 0.45);
  }
  /* a strip of tape holding it down */
  .pad__tape {
    position: absolute;
    top: -11px;
    left: 50%;
    width: 96px;
    height: 22px;
    translate: -50% 0;
    transform: rotate(-2deg);
    background: rgba(255, 255, 255, 0.32);
    border-left: 1px dashed rgba(255, 255, 255, 0.55);
    border-right: 1px dashed rgba(255, 255, 255, 0.55);
    box-shadow: 0 2px 6px -3px rgba(0, 0, 0, 0.4);
    pointer-events: none;
  }
  .pad__area {
    display: block;
    width: 100%;
    min-height: 156px;
    padding: 0;
    font-family: var(--display);
    font-size: 16px;
    line-height: 1.6;
    color: #2c2417;
    background: none;
    border: 0;
    resize: none;
    outline: none;
  }
  .pad__area::placeholder {
    color: rgba(74, 52, 5, 0.45);
  }
  .pad__area:disabled {
    opacity: 0.6;
  }
  .pad__text {
    margin: 0;
    min-height: 156px;
    font-family: var(--display);
    font-size: 16px;
    line-height: 1.6;
    color: #2c2417;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .pad__foot {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px dashed rgba(74, 52, 5, 0.28);
  }
</style>
