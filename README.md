# v1 initializing
1. download pnpm
2. git this code
3. pnpm i 


# v2 jsx
1. cd to /packages/react and pnpm init

    main is the entry point of CJS, module is the entry point of ESM. Don't forget to replace main with module.
2. cd to /packages/shared and pnpm init

    No need for main since all methods in shared would be imported by others directly.
3. write the createElement, jsx, jexDEV
4. pnpm run build:dev 
    
    build methods to dist,and cd to dist/node_module/react
5. run the first test method

    pnpm link --global
    cra a new react app,and do pnpm link react --global to see the jsx in console.

    


# File & Directory
    -/packages

        -/react : environment unrelated  public methods.

        -/react-reconciler : environment unrelated, Implementation of reconciler.

        -/shared : environment unrelated public utils methods



# Memo
1. use Rollup to manage and build project
