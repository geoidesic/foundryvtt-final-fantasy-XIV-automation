<script>
  import { onMount, getContext } from "svelte";
  import { fade, scale }        from 'svelte/transition';
  import { ApplicationShell }   from '#runtime/svelte/component/core';
  import { localize } from "#runtime/svelte/helper";
  import { MODULE_ID, MODULE_TITLE } from "~/src/helpers/constants";

  export let elementRoot = void 0;
  export let version = void 0;

  const application = getContext('#external').application;

  const handleChange = (event) => {
    alert('changed')
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
    main
      p This module provides automation for Final Fantasy XIV combat.
      p It is currently in development and not all actions are automated. If you wish to support the development of this module, please consider a monthly donation via <a href="https://github.com/sponsors/geoidesic">GitHub Sponsors</a>.
      p Current version: {version}
      p
    footer
      .flex2.right
        img.pt-sm.white(src="/systems/foundryvtt-final-fantasy/assets/round-table-games-logo.svg" alt="Round Table Games Logo" height="50" width="50" style="fill: white; border: none; width: auto;")
      .flex2.left.pt-sm
        h4 {MODULE_TITLE} 
        a(href="https://www.round-table.games") Round Table Games ©2025

</template>

<style lang="sass">
  @use "../../styles/Mixins.sass" as mixins
  main
    @include mixins.inset
    overflow-y: auto
    margin-bottom: 5em


  .white
    filter: invert(1)
    
  footer
    border-top: 8px ridge var(--border-shadow)
    display: grid
    grid-column-gap: 1rem
    grid-template-columns: 1fr 1.5fr
    position: fixed
    bottom: 0
    left: 0
    right: 0
    background-color: #333
    color: white
    text-align: center
    padding: 1em
    font-size: 0.8em
    z-index: 3
    img
      min-width: 70px
    a
      color: white
      text-decoration: underline
      &:hover
        color: #ccc
</style>
