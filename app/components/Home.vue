<template>
    <Page>
        <ActionBar>
            <Label text="Home"/>
        </ActionBar>

        <GridLayout>
            <Label class="text-xl align-middle text-center text-gray-500" :text="message" />
        </GridLayout>
    </Page>
</template>

<script lang="ts">
  import { defineComponent } from 'nativescript-vue'

  export default defineComponent({
    computed: {
      message() {
        return "Blank {N}-Vue app";
      }
    }
  });
</script>
