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
  const env_spec = ['https://cdn.holoviz.org/panel/1.2.3/dist/wheels/bokeh-3.2.2-py3-none-any.whl', 'https://cdn.holoviz.org/panel/1.2.3/dist/wheels/panel-1.2.3-py3-none-any.whl', 'pyodide-http==0.2.1', 'holoviews', 'hvplot', 'numpy', 'pandas']
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
from panel.template import FastListTemplate
pn.extension('tabulator')
pn.extension(sizing_mode='stretch_width')
import hvplot.pandas
import holoviews as hv


# In[20]:


# Cache data to improve performance
if 'data' not in pn.state.cache.keys():
    df = pd.read_csv('https://nyc3.digitaloceanspaces.com/owid-public/data/energy/owid-energy-data.csv')
    pn.state.cache['data'] = df.copy()
else: 
    df = pn.state.cache['data']


# In[ ]:


df.columns


# In[22]:


coal_columns = [col for col in df.columns if col.startswith('coal')]
coal_columns


# ### (0) Data preprocessing

# In[23]:


# Fill NAs with 0s
df = df.fillna(0)
df['gdp_per_capita'] = np.where(df['population']!=0, df['gdp']/df['population'],0)


# In[24]:


# Make DF pipeline interactive
idf = df.interactive()


# ### (1) Coal consumption over time by continent

# In[25]:


# Define panel widgets
year_slider = pn.widgets.IntSlider(name='Year slider', start=1960, end=2022, step=5, value=1970)
year_slider


# In[26]:


# Radio buttons for coal measures
yaxis_coal = pn.widgets.RadioButtonGroup(
    name = 'Y axis',
    options = ['coal_consumption', 'coal_cons_per_capita'],
    button_type = 'success'
)


# In[27]:


# Connect data pipeline with widgets
continents = ['World', 'Asia', 'Oceania', 'Europe', 'Africa', 'North America', 'South America', 'Antarctica']

# Create a subset of idf based on specified conditions
coal_pipeline = (
    idf[
        (idf.year >= year_slider) &  # Filter rows for year <= year_slider
        (idf.country.isin(continents))
    ]
    .groupby(['country', 'year','coal_production'])[yaxis_coal].mean() # Average of yaxis_coal for each country over time (year)
    .to_frame() # Convert result to df
    .reset_index()
    .sort_values(by='year')
    .reset_index(drop=True) # Discard old index and assign default integer index
)


# In[28]:


coal_pipeline.tail(10)


# In[29]:


# Plot the data
coal_plot = coal_pipeline.hvplot(x = 'year', by='country', y=yaxis_coal, line_width=2, title="Coal Consumption by Continent")


# ### (2) Heatmap - Coal production over time

# In[30]:


# coal_table = coal_pipeline.pipe(pn.widgets.Tabulator, pagination='remote', page_size = 10, sizing_mode='stretch_width')
coal_heatmap = coal_pipeline.hvplot.heatmap(x='year', y='country', C='coal_production', cmap='Set3', title='Coal Production by Continent')


# ### (3) Coal vs GDP Scatterplot

# In[31]:


# Create a subset of idf based on specified conditions
coal_gdp_pipeline = (
    idf[
        (idf.year == year_slider) & 
        (~ (idf.country.isin(continents)))
    ]
    .groupby(['country', 'year', 'gdp_per_capita'])['coal_consumption'].mean() # Average of coal_consumption for each country over time (year)
    .to_frame() # Convert result to df
    .reset_index()
    .sort_values(by='year')
    .reset_index(drop=True) # Discard old index and assign default integer index
)


# In[32]:


coal_gdp_pipeline


# In[ ]:


coal_gdp_scatterplot = coal_gdp_pipeline.hvplot(x='gdp_per_capita', y='coal_consumption', by='country', size=80, kind="scatter", alpha=0.7, legend=False, height=500, width=500, title='Coal Consumption vs GDP Per Capita by Country')
coal_gdp_scatterplot


# ### (4) Bar chart with coal facts by continent

# In[34]:


# Create a separate widget for the chart
yaxis_coal_facts = pn.widgets.RadioButtonGroup(
    name='Y axis',
    options=['coal_cons_change_pct', 'energy_cons_change_pct', 'coal_share_energy'],
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


# ### (5) Repeat the steps above for oil

# In[36]:


# Radio buttons for gas measures
df['oil_cons_per_capita'] = df['oil_consumption'] / df['population']
yaxis_oil = pn.widgets.RadioButtonGroup(
    name = 'Y axis',
    options = ['oil_consumption', 'oil_cons_per_capita'],
    button_type = 'success'
)

# Create a subset of idf based on specified conditions
oil_pipeline = (
    idf[
        (idf.year >= year_slider) &  # Filter rows for year >= year_slider
        (idf.country.isin(continents))
    ]
    .groupby(['country', 'year','oil_production'])[yaxis_oil].mean() # Average of yaxis_oil for each country over time (year)
    .to_frame() # Convert result to df
    .reset_index()
    .sort_values(by='year')
    .reset_index(drop=True) # Discard old index and assign default integer index
)

oil_plot = oil_pipeline.hvplot(x = 'year', by='country', y=yaxis_oil, line_width=2, title="Oil Consumption by Continent")
# oil_table = oil_pipeline.pipe(pn.widgets.Tabulator, pagination='remote', page_size = 10, sizing_mode='stretch_width')
oil_heatmap = oil_pipeline.hvplot.heatmap(x='year', y='country', C='oil_production', cmap='Set3', title='Oil Production by Continent')

# Create a subset of idf based on specified conditions
oil_gdp_pipeline = (
    idf[
        (idf.year == year_slider) & 
        (~ (idf.country.isin(continents)))
    ]
    .groupby(['country', 'year', 'gdp_per_capita', 'oil_cons_per_capita'])['oil_consumption'].mean() # Average of coal_consumption for each country over time (year)
    .to_frame() # Convert result to df
    .reset_index()
    .sort_values(by='year')
    .reset_index(drop=True) # Discard old index and assign default integer index
)

oil_gdp_scatterplot = oil_gdp_pipeline.hvplot(x='gdp_per_capita', y='oil_consumption', by='country', size=80, kind="scatter", alpha=0.7, legend=False, height=500, width=500,title='Oil Consumption vs GDP Per Capita by Country')
# Create a separate widget for the chart
yaxis_oil_facts = pn.widgets.RadioButtonGroup(
    name='Y axis',
    options=['oil_cons_change_pct', 'energy_cons_change_pct', 'oil_share_energy'],
    button_type='success'
)
oil_facts_bar_pipeline =  (
    idf[
        (idf.year == year_slider) & 
        (idf.country.isin(continents_excl))
    ]
    .groupby(['year', 'country'])[yaxis_oil_facts].sum()
    .to_frame() # Convert result to df
    .reset_index()
    .sort_values(by='year')
    .reset_index(drop=True) # Discard old index and assign default integer index
)
oil_facts_bar_plot = oil_facts_bar_pipeline.hvplot(kind='bar', x='country', y=yaxis_oil_facts, title='Oil Facts by Continent')


# ### (5) Build the dashboard

# In[ ]:


# Define your data and widgets here
class PageCoal:
    def __init__(self):
        self.content = pn.Column(
            "# Coal",
            pn.Row(
                pn.Column(yaxis_coal, coal_plot.panel(width=600), margin=(0, 25)),
                pn.Column(coal_heatmap.panel(width=700))
            ),
            pn.Row(
                pn.Column(coal_gdp_scatterplot.panel(width=600), margin=(0, 25)),
                pn.Column(yaxis_coal_facts, coal_facts_bar_plot.panel(width=700))
            )
        )

    def view(self):
        return self.content

class PageOil:
    def __init__(self):
        self.content = pn.Column(
            "# Oil",
            pn.Row(
                pn.Column(yaxis_oil, oil_plot.panel(width=600), margin=(0, 25)),
                pn.Column(oil_heatmap.panel(width=700))
            ),
            pn.Row(
                pn.Column(oil_gdp_scatterplot.panel(width=600), margin=(0, 25)),
                pn.Column(yaxis_oil_facts, oil_facts_bar_plot.panel(width=700))
            )
        )

    def view(self):
        return self.content

pages = {
    "Coal": PageCoal(),
    "Oil": PageOil(),
}

# Function to show the selected page
def show_page(page_instance):
    main_area.clear()
    main_area.append(page_instance.view())

# Define buttons to navigate between pages
page_coal_button = pn.widgets.Button(name="Coal", button_type="primary", width=250)
page_oil_button = pn.widgets.Button(name="Oil", button_type="primary", width=250)

# Set up button click callbacks
page_coal_button.on_click(lambda event: show_page(pages["Coal"]))
page_oil_button.on_click(lambda event: show_page(pages["Oil"]))

# Create the main area and display the first page
main_area = pn.Column(pages["Coal"].view())

# Create the Material Template and set the sidebar and main area
template = FastListTemplate(
    title="World Energy Dashboard",
    sidebar=[pn.pane.Markdown("#### This interactive panel provides insights into global energy trends and patterns over time. Select from the options below."),
             page_coal_button, 
             page_oil_button, 
             pn.pane.Markdown("## Settings"),
             year_slider],
    main=[main_area],
    accent_base_color="#d88888",
    header_background="#d8b088",
    sidebar_width=320
)

# Serve the Panel app
template.servable()



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