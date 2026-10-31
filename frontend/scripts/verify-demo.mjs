// Local smoke check; never prints credentials or embeds them into frontend assets.
import { chromium } from '@playwright/test'
import fs from 'node:fs'
const accounts=JSON.parse(fs.readFileSync(new URL('../../.local/demo-accounts.json',import.meta.url),'utf8'))
const browser=await chromium.launch()
try {
  for(const role of ['CUSTOMER','OPERATOR','ADMIN']){
    const context=await browser.newContext()
    const page=await context.newPage()
    await page.goto(`http://127.0.0.1:5173/login/${role.toLowerCase()}`)
    await page.getByLabel('Email address').fill(accounts[role].email)
    await page.getByLabel('Password',{exact:true}).fill(accounts[role].password)
    await page.getByRole('button',{name:'Sign in',exact:true}).click()
    await page.waitForURL(`**/${role==='CUSTOMER'?'app':role.toLowerCase()}/dashboard`)
    await page.reload()
    await page.getByRole('navigation',{name:'Workspace navigation'}).waitFor()
    const destinations=role==='CUSTOMER'?['Find parking','My vehicles','Reservations','Booking history','Notifications','My profile','Preferences']:role==='OPERATOR'?['My facilities','Parking spaces','Reservations','Occupancy','Reports','My profile']:['Users','Roles & access','Facilities','Parking spaces','Reservations','Analytics','Audit trail','System settings']
    for(const label of destinations){
      await page.getByRole('navigation',{name:'Workspace navigation'}).getByRole('link',{name:label,exact:true}).click()
      await page.locator('main h1').waitFor()
      await page.getByRole('button',{name:'Back',exact:true}).waitFor()
      if(await page.getByRole('alert').count())throw new Error(`${role} ${label}: page error`)
    }
    await page.getByRole('button',{name:'Sign out',exact:true}).click()
    await page.waitForURL(`**/login/${role.toLowerCase()}`)
    await page.goBack()
    await page.waitForURL(`**/login/${role.toLowerCase()}`)
    console.log(`${role}: database login, dashboard, refresh, logout, and Back protection passed`)
    await context.close()
  }
} finally {await browser.close()}
