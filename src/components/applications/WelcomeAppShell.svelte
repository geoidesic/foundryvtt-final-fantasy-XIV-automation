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
    main
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
      .flexrow.dont-show.justify-vertical.mt-sm(data-tooltip="{localize('Setting.DontShowWelcome.Hint')}")
        .flex0
          input(type="checkbox" on:change="{handleChange}" label="{localize('Setting.DontShowWelcome.Name')}" bind:checked="{dontShowWelcome}") 
        .flex
          span {localize('Setting.DontShowWelcome.Name')}
    footer
      .flex2.right
        img.pt-sm.white(src="/systems/foundryvtt-final-fantasy/assets/round-table-games-logo.svg" alt="Round Table Games Logo" height="50" width="50" style="fill: white; border: none; width: auto;")
      .flex2.left.pt-sm
        h4 {MODULE_TITLE} 
        a(href="https://www.round-table.games") Round Table Games

</template>

<style lang="sass">
  @use "../../styles/Mixins.sass" as mixins
  main
    overflow-y: auto
    margin-bottom: 4em
    .inset
      @include mixins.inset


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
