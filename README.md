# Energy Visualization Dashboard

- Interactive visualization dashboard of energy data from [Our World in Data](https://github.com/owid/energy-data)
- Visualizes coal and oil trends using line graphs, heatmaps, scatter plots, and bar graphs
- Allows users to navigate pages using button selectors
- [App URL](https://rubinghimire.github.io/energy-visualization-dashboard)

# Tech Stack

- Python, pandas, NumPy, Panel, hvPlot, HoloViews

# Installation

- Download zip and extract files
- Go inside the project directory
- Python:
  - Create a virtual environment (venv) `python -m venv /path/to/directory`
  - Activate the venv `path\to\venv\Scripts\activate.bat`
  - Install dependencies `pip install -r requirements.txt`
  - Run the application `panel serve energy_dashboard.ipynb`
  - Access the dashboard from the browser `localhost:5006/energy_dashboard`
- HTML (no installation required): access the dashboard by running the `index.html` file in a server environment

# Credits

- [Thu Vu](https://github.com/thu-vu92) for providing the base code
- My modifications:
  - Adapted code for a different data set
  - Added pagination feature, heatmap and tweaked style
  - Improved performance by 30%
  - Included comments in the notebook for better readability

# License

[![License: Unlicense](https://img.shields.io/badge/license-Unlicense-blue.svg)](http://unlicense.org)
