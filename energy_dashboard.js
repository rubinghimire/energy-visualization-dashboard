importScripts("https://cdn.jsdelivr.net/pyodide/v0.23.4/pyc/pyodide.js");

function sendPatch(patch, buffers, msg_id) {
  self.postMessage({
    type: 'patch',
    patch: patch,
    buffers: buffers
  })
}

async function startApplication() {
  console.log("Loading pyodide!");
  self.postMessage({type: 'status', msg: 'Loading pyodide'})
  self.pyodide = await loadPyodide();
  self.pyodide.globals.set("sendPatch", sendPatch);
  console.log("Loaded!");
  await self.pyodide.loadPackage("micropip");
  const env_spec = ['https://cdn.holoviz.org/panel/1.2.3/dist/wheels/bokeh-3.2.2-py3-none-any.whl', 'https://cdn.holoviz.org/panel/1.2.3/dist/wheels/panel-1.2.3-py3-none-any.whl', 'pyodide-http==0.2.1', 'hvplot', 'numpy', 'pandas']
  for (const pkg of env_spec) {
    let pkg_name;
    if (pkg.endsWith('.whl')) {
      pkg_name = pkg.split('/').slice(-1)[0].split('-')[0]
    } else {
      pkg_name = pkg
    }
    self.postMessage({type: 'status', msg: `Installing ${pkg_name}`})
    try {
      await self.pyodide.runPythonAsync(`
        import micropip
        await micropip.install('${pkg}');
      `);
    } catch(e) {
      console.log(e)
      self.postMessage({
	type: 'status',
	msg: `Error while installing ${pkg_name}`
      });
    }
  }
  console.log("Packages loaded!");
  self.postMessage({type: 'status', msg: 'Executing code'})
  const code = `
  
import asyncio

from panel.io.pyodide import init_doc, write_doc

init_doc()

#!/usr/bin/env python
# coding: utf-8

# In[ ]:


import pandas as pd
import numpy as np
import panel as pn
pn.extension('tabulator')

import hvplot.pandas


# In[2]:


# Cache data to improve performance
if 'data' not in pn.state.cache.keys():
    df = pd.read_csv('https://nyc3.digitaloceanspaces.com/owid-public/data/energy/owid-energy-data.csv')
    pn.state.cache['data'] = df.copy()
else: 
    df = pn.state.cache['data']


# In[ ]:


# Explore the dataframe
df


# In[ ]:


df.columns


# In[ ]:


df[df['country'] == 'Asia']


# In[6]:


coal_columns = [col for col in df.columns if col.startswith('coal')]


# In[ ]:


coal_columns


# ### (0) Data preprocessing

# In[8]:


# Fill NAs with 0s
df = df.fillna(0)


# In[9]:


# Make DF pipeline interactive
idf = df.interactive()


# ### (1) Coal consumption over time by continent

# In[10]:


# Define panel widgets
year_slider = pn.widgets.IntSlider(name='Year slider', start=1960, end=2022, step=5, value=1970)
year_slider


# In[11]:


# Radio buttons for coal measures
yaxis_coal = pn.widgets.RadioButtonGroup(
    name = 'Y axis',
    options = ['coal_consumption', 'coal_cons_per_capita'],
    button_type = 'success'
)


# In[12]:


# Connect data pipeline with widgets
continents = ['World', 'Asia', 'Oceania', 'Europe', 'Africa', 'North America', 'South America', 'Antarctica']

# Create a subset of idf based on specified conditions
coal_pipeline = (
    idf[
        (idf.year >= year_slider) &  # Filter rows for year <= year_slider
        (idf.country.isin(continents))
    ]
    .groupby(['country', 'year'])[yaxis_coal].mean() # Average of yaxis_coal for each country over time (year)
    .to_frame() # Convert result to df
    .reset_index()
    .sort_values(by='year')
    .reset_index(drop=True) # Discard old index and assign default integer index
)


# In[13]:


coal_pipeline.tail(10)


# In[ ]:


# Plot the data
coal_plot = coal_pipeline.hvplot(x = 'year', by='country', y=yaxis_coal, line_width=2, title="Coal Consumption by Continent")
coal_plot


# ### (2) Table - Coal consumption over time by continent

# In[15]:


coal_table = coal_pipeline.pipe(pn.widgets.Tabulator, pagination='remote', page_size = 10, sizing_mode='stretch_width')
coal_table


# ### (3) Coal vs GDP scatterplot

# In[16]:


# Create a subset of idf based on specified conditions
coal_gdp_pipeline = (
    idf[
        (idf.year == year_slider) & 
        (~ (idf.country.isin(continents)))
    ]
    .groupby(['country', 'year', 'coal_cons_per_capita'])['coal_consumption'].mean() # Average of coal_consumption for each country over time (year)
    .to_frame() # Convert result to df
    .reset_index()
    .sort_values(by='year')
    .reset_index(drop=True) # Discard old index and assign default integer index
)


# In[17]:


coal_gdp_pipeline


# In[ ]:


coal_gdp_scatterplot = coal_gdp_pipeline.hvplot(x='coal_cons_per_capita', y='coal_consumption', by='country', size=80, kind="scatter", alpha=0.7, legend=False, height=500, width=500)
coal_gdp_scatterplot


# ### (4) Bar chart with coal facts by continent

# In[30]:


# Create a separate widget for the chart
yaxis_coal_facts = pn.widgets.RadioButtonGroup(
    name='Y axis',
    options=['coal_cons_change_pct', 'coal_production', 'coal_share_energy'],
    button_type='success'
)

continents_excl = ['Asia', 'Oceania', 'Europe', 'Africa', 'North America', 'South America', 'Antarctica']
coal_facts_bar_pipeline =  (
    idf[
        (idf.year == year_slider) & 
        (idf.country.isin(continents_excl))
    ]
    .groupby(['year', 'country'])[yaxis_coal_facts].sum()
    .to_frame() # Convert result to df
    .reset_index()
    .sort_values(by='year')
    .reset_index(drop=True) # Discard old index and assign default integer index
)    


# In[ ]:


coal_facts_bar_plot = coal_facts_bar_pipeline.hvplot(kind='bar', x='country', y=yaxis_coal_facts, title='Coal Facts by Continent')
coal_facts_bar_plot


# ### (5) Build the dashboard

# In[36]:


#Layout using Template
template = pn.template.FastListTemplate(
    title='World Energy Dashboard',
    # Elements/design for sidebar 
    sidebar=[pn.pane.Markdown("# Coal Consumption"), 
             pn.pane.Markdown("#### This interactive panel provides insights into the global coal consumption trends and patterns over time."),
             pn.pane.JPG('globe_bulb.jpg', sizing_mode='scale_both'),
             pn.pane.Markdown("## Settings"),   
             year_slider],
    # Elements/design for main section
    main=[pn.Row(pn.Column(yaxis_coal, 
                           coal_plot.panel(width=600), margin=(0,25)), 
                 coal_table.panel(width=300)), 
          pn.Row(pn.Column(coal_gdp_scatterplot.panel(width=550), margin=(0,25)), 
                 pn.Column(yaxis_coal_facts, coal_facts_bar_plot.panel(width=630)))],
    accent_base_color="#d88888",
    header_background="#d8b088",
    sidebar_width=250
)
# template.show()
template.servable();



await write_doc()
  `

  try {
    const [docs_json, render_items, root_ids] = await self.pyodide.runPythonAsync(code)
    self.postMessage({
      type: 'render',
      docs_json: docs_json,
      render_items: render_items,
      root_ids: root_ids
    })
  } catch(e) {
    const traceback = `${e}`
    const tblines = traceback.split('\n')
    self.postMessage({
      type: 'status',
      msg: tblines[tblines.length-2]
    });
    throw e
  }
}

self.onmessage = async (event) => {
  const msg = event.data
  if (msg.type === 'rendered') {
    self.pyodide.runPythonAsync(`
    from panel.io.state import state
    from panel.io.pyodide import _link_docs_worker

    _link_docs_worker(state.curdoc, sendPatch, setter='js')
    `)
  } else if (msg.type === 'patch') {
    self.pyodide.globals.set('patch', msg.patch)
    self.pyodide.runPythonAsync(`
    state.curdoc.apply_json_patch(patch.to_py(), setter='js')
    `)
    self.postMessage({type: 'idle'})
  } else if (msg.type === 'location') {
    self.pyodide.globals.set('location', msg.location)
    self.pyodide.runPythonAsync(`
    import json
    from panel.io.state import state
    from panel.util import edit_readonly
    if state.location:
        loc_data = json.loads(location)
        with edit_readonly(state.location):
            state.location.param.update({
                k: v for k, v in loc_data.items() if k in state.location.param
            })
    `)
  }
}

startApplication()