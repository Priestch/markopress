---
title: Marko Tags Test
---

# Marko Components in Markdown

## Alert with body content

<alert-box type="warning">
  This is a warning alert with **markdown** support!
</alert-box>

## Button with attributes

<custom-button href="/" label="Home Page"/>

## Card with nested components

<card>
  <card-header>
    <h3>Card Title</h3>
  </card-header>
  <card-body>
    This is card content.
  </card-body>
</card>

## Alert with attributes

<alert-box type="info" message="Info with **markdown**!"/>
