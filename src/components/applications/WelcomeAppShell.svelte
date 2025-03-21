<script>
  import { onMount, getContext } from "svelte";
  import { fade, scale }        from 'svelte/transition';
  import { ApplicationShell }   from '#runtime/svelte/component/core';
  import { localize } from "~/src/helpers/util";
  import { MODULE_ID, MODULE_TITLE } from "~/src/helpers/constants";

  export let elementRoot = void 0;
  export let version = void 0;

  const application = getContext('#external').application;

  const handleChange = (event) => {
    game.settings.set(MODULE_ID, 'dontShowWelcome', event.target.checked);
  }


  let draggable = application.reactive.draggable;
  draggable = true

  $: application.reactive.draggable = draggable;
  $: dontShowWelcome = game.settings.get(MODULE_ID, 'dontShowWelcome');

  onMount(async () => {
  });
  
</script>

<svelte:options accessors={true}/>

<template lang="pug">
  ApplicationShell(bind:elementRoot)
    main.relative
      .inset.mb-sm
        p.lightest 
          i.fa-solid.fa-info-circle.mr-sm
          | {localize('Setting.DontShowWelcome.Introduction')}
        p.lighter
          i.fa-solid.fa-bug.mr-sm
          | {localize('Setting.DontShowWelcome.Bugs')} <a href="https://github.com/geoidesic/foundryvtt-final-fantasy/issues"> {localize('Setting.DontShowWelcome.IssuesLinkText')} </a>
        p 
          i.fa-solid.fa-heart.mr-sm(style="color: #660000;")
          | {localize('Setting.DontShowWelcome.Support')} <a href='https://github.com/sponsors/geoidesic'> {localize('Setting.DontShowWelcome.SponsorLinkText')} </a> or <a href='https://https://paypal.me/geoidesic'>PayPal</a>
      
      p.smallest.lightest {localize('Setting.DontShowWelcome.Disclaimer')}
    footer
      .right
        img.pt-sm.mr-md(src="/systems/foundryvtt-final-fantasy/assets/aardvark-logo.webp" alt="Aardvark Logo" height="40" width="40" style="fill: white; border: none; width: auto;")
      .left.pt-sm
        h4 {MODULE_TITLE} 
        .smaller 
          span Foundry conversion by 
          a(href="https://www.aardvark.games") Aardvark Games
    .flexrow.dont-show.justify-vertical.mt-sm(data-tooltip="{localize('Setting.DontShowWelcome.Hint')}")
      .flex0
        input(type="checkbox" on:change="{handleChange}" label="{localize('Setting.DontShowWelcome.Name')}" bind:checked="{dontShowWelcome}") 
      .flex
        span {localize('Setting.DontShowWelcome.Name')}

</template>

<style lang="sass">
  @use "../../styles/Mixins.sass" as mixins
  main
    overflow-y: auto
    margin-bottom: 4em
    .inset
      @include mixins.inset
      padding: 0.5em 1em
    i
      margin-right: 0.5em

  .white
    filter: invert(1)

  .lightest
    opacity: 0.5

  .lighter
    opacity: 0.75
  
  .dont-show
    font-size: smaller
    input
      cursor: pointer
    background-color: #000
    position: absolute
    left: 0
    bottom: 60px
    width: 100%
    color: #9988bb
  footer
    display: grid
    grid-column-gap: 1rem
    grid-template-columns: 1fr 3.5fr
    position: fixed
    bottom: 0
    left: 0
    right: 0
    background-color: #333
    color: white
    text-align: center
    padding: 0.5em 1em 1em 1em
    font-size: 0.8em
    z-index: 3
    line-height: 1.25em
    a
      color: white
      text-decoration: underline
      &:hover
        color: #ccc
</style>
