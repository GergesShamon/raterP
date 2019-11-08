import BannerWidget from "./Components/BannerWidget";
import BannerListWidget from "./Components/BannerListWidget";
import SuggestionLookupTextInputWidget from "./Components/SuggestionLookupTextInputWidget";
import * as cache from "../cache";
import {getBannerOptions} from "../getBanners";
import appConfig from "../config";
import API, { makeErrorMsg } from "../api";
import PrefsFormWidget from "./Components/PrefsFormWidget";
import { setPrefs as ApiSetPrefs } from "../prefs";
import { parseTemplates } from "../Template";
import config from "../config";

function MainWindow( config ) {
	MainWindow.super.call( this, config );
}
OO.inheritClass( MainWindow, OO.ui.ProcessDialog );

MainWindow.static.name = "main";
MainWindow.static.title = $("<span>").css({"font-weight":"normal"}).append(
	$("<a>").css({"font-weight": "bold"}).attr({"href": mw.util.getUrl("WP:RATER"), "target": "_blank"}).text("Rater"),
	" (",
	$("<a>").attr({"href": mw.util.getUrl("WT:RATER"), "target": "_blank"}).text("talk"),
	") ",
	$("<span>").css({"font-size":"90%"}).text("v"+config.script.version)
);
MainWindow.static.size = "large";
MainWindow.static.actions = [
	// Primary (top right):
	{
		label: "X", // not using an icon since color becomes inverted, i.e. white on light-grey
		title: "Close (and discard any changes)",
		flags: "primary",
		modes: ["edit", "diff", "preview"] // available when current mode isn't "prefs"
	},
	// Safe (top left)
	{
		action: "showPrefs",
		flags: "safe",
		icon: "settings",
		title: "help",
		modes: ["edit", "diff", "preview"] // available when current mode isn't "prefs"
	},
	// Others (bottom)
	{
		action: "save",
		accessKey: "s",
		label: new OO.ui.HtmlSnippet("<span style='padding:0 1em;'>Save</span>"),
		flags: ["primary", "progressive"],
		modes: ["edit", "diff", "preview"] // available when current mode isn't "prefs"
	},
	{
		action: "preview",
		accessKey: "p",
		label: "Show preview",
		modes: ["edit", "diff"] // available when current mode isn't "preview" or "prefs"
	},
	{
		action: "changes",
		accessKey: "v",
		label: "Show changes",
		modes: ["edit", "preview"] // available when current mode isn't "diff" or "prefs"
	},
	{
		action: "back",
		label: "Back",
		modes: ["diff", "preview"] // available when current mode is "diff" or "prefs"
	},
	
	// "prefs" mode only
	{
		action: "savePrefs",
		label: "Update",
		flags: ["primary", "progressive"],
		modes: "prefs" 
	},
	{
		action: "closePrefs",
		label: "Cancel",
		flags: "safe",
		modes: "prefs"
	}
];

// Customize the initialize() function: This is where to add content to the dialog body and set up event handlers.
MainWindow.prototype.initialize = function () {
	// Call the parent method.
	MainWindow.super.prototype.initialize.call( this );

	/* --- PREFS --- */
	this.preferences = appConfig.defaultPrefs;
	
	/* --- TOP BAR --- */
	
	// Search box
	this.searchBox = new SuggestionLookupTextInputWidget( {
		placeholder: "Add a WikiProject...",
		suggestions: cache.read("bannerOptions"),
		$element: $("<div style='display:inline-block;margin-right:-1px;width:calc(100% - 45px);'>"),
		$overlay: this.$overlay,
	} );
	getBannerOptions().then(bannerOptions => this.searchBox.setSuggestions(bannerOptions));
	this.addBannerButton = new OO.ui.ButtonWidget( {
		icon: "add",
		title: "Add",
		flags: "progressive",
		$element: $("<span style='float:right;margin:0'>"),
	} );
	var $searchContainer = $("<div style='display:inline-block;width: calc(100% - 220px);min-width: 220px;float:left'>")
		.append(this.searchBox.$element, this.addBannerButton.$element);

	// Set all classes/importances, in the style of a popup button with a menu.
	// (Is actually a dropdown with a hidden label, because that makes the coding easier.)
	this.setAllDropDown = new OO.ui.DropdownWidget( {
		icon: "tag",
		label: "Set all...",
		invisibleLabel: true,
		menu: {
			items: [
				new OO.ui.MenuSectionOptionWidget( {
					label: "Classes"
				} ),
				...appConfig.bannerDefaults.classes.map(classname => new OO.ui.MenuOptionWidget( {
					data: {class: classname.toLowerCase()},
					label: classname
				} )
				),
				new OO.ui.MenuSectionOptionWidget( {
					label: "Importances"
				} ),
				...appConfig.bannerDefaults.importances.map(importance => new OO.ui.MenuOptionWidget( {
					data: {importance: importance.toLowerCase()},
					label: importance
				} )
				)
			]
		},
		$element: $("<span style=\"width:auto;display:inline-block;float:left;margin:0\" title='Set all...'>"),
		$overlay: this.$overlay,
	} );

	// Remove all banners button
	this.removeAllButton = new OO.ui.ButtonWidget( {
		icon: "trash",
		title: "Remove all",
		flags: "destructive"
	} );

	// Clear all parameters button
	this.clearAllButton = new OO.ui.ButtonWidget( {
		icon: "cancel",
		title: "Clear all",
		flags: "destructive"
	} );

	// Group the buttons together
	this.menuButtons = new OO.ui.ButtonGroupWidget( {
		items: [
			this.removeAllButton,
			this.clearAllButton
		],
		$element: $("<span style='float:left;'>"),
	} );
	this.menuButtons.$element.prepend(this.setAllDropDown.$element);

	// Put everything into a layout
	this.topBar = new OO.ui.PanelLayout( {
		expanded: false,
		framed: false,
		padded: false,
		$element: $("<div style='position:fixed;width:100%;background:#ccc'>")
	} );
	this.topBar.$element.append(
		$searchContainer,
		//this.setAllDropDown.$element,
		this.menuButtons.$element
	);
	this.topBar.setDisabled = (disable => [
		this.searchBox,
		this.addBannerButton,
		this.setAllDropDown,
		this.removeAllButton,
		this.clearAllButton
	].forEach(widget => widget.setDisabled(disable))
	);

	// Append to the default dialog header
	this.$head.css({"height":"73px"}).append(this.topBar.$element);

	/* --- FOOTER --- */
	this.oresLabel = new OO.ui.LabelWidget({
		$element: $("<span style='float:right; padding: 10px; max-width: 33.33%; text-align: center;'>"),
		label: $("<span>").append(
			$("<a>")
				.attr({"href":mw.util.getUrl("mw:ORES"), "target":"_blank"})
				.append(
					$("<img>")
						.css({"vertical-align": "text-bottom;"})
						.attr({
							"src": "//upload.wikimedia.org/wikipedia/commons/thumb/5/51/Objective_Revision_Evaluation_Service_logo.svg/40px-Objective_Revision_Evaluation_Service_logo.svg.png",
							"title": "Machine predicted quality from ORES",
							"alt": "ORES logo",
							"width": "20px",
							"height": "20px"
						})
				),
			" ",
			$("<span class='oresPrediction'>")
		)
	}).toggle(false);
	this.$foot.prepend(this.oresLabel.$element);

	/* --- CONTENT AREA --- */

	// Banners added dynamically upon opening, so just need a layout with an empty list
	this.bannerList = new BannerListWidget({
		preferences: this.preferences
	});
	this.editLayout = new OO.ui.PanelLayout( {
		padded: false,
		expanded: false,
		$content: this.bannerList.$element
	} );

	// Preferences, filled in with current prefs upon loading.
	// TODO: Make this into a component, add fields and inputs
	this.prefsForm = new PrefsFormWidget();
	this.prefsLayout = new OO.ui.PanelLayout( {
		padded: true,
		expanded: false,
		$content: this.prefsForm.$element
	} );

	// Preview, Show changes
	this.parsedContentContainer = new OO.ui.FieldsetLayout( {
		label: "Preview"
	} );
	this.parsedContentWidget = new OO.ui.LabelWidget( {label: "",	$element:$("<div>")	});
	this.parsedContentContainer.addItems([
		new OO.ui.FieldLayout(
			this.parsedContentWidget,			
			{ align: "top" }
		)
	]);
	this.parsedContentLayout = new OO.ui.PanelLayout( {
		padded: true,
		expanded: false,
		$content: this.parsedContentContainer.$element
	} );

	this.contentArea = new OO.ui.StackLayout( {
		items: [
			this.editLayout,
			this.prefsLayout,
			this.parsedContentLayout
		],
		padded: false,
		expanded: false
	} );

	this.$body.css({"top":"73px"}).append(this.contentArea.$element);

	/* --- EVENT HANDLING --- */

	this.searchBox.connect(this, {
		"enter": "onSearchSelect",
		"choose": "onSearchSelect"
	});
	this.addBannerButton.connect(this, {"click": "onSearchSelect"});
};

// Override the getBodyHeight() method to specify a custom height
MainWindow.prototype.getBodyHeight = function () {
	var currentlayout = this.contentArea.getCurrentItem();
	var layoutHeight = currentlayout && currentlayout.$element.outerHeight(true);
	var contentHeight = currentlayout && currentlayout.$element.children(":first-child").outerHeight(true);
	return Math.max(200, layoutHeight, contentHeight);
};

// Use getSetupProcess() to set up the window with data passed to it at the time 
// of opening
MainWindow.prototype.getSetupProcess = function ( data ) {
	data = data || {};
	return MainWindow.super.prototype.getSetupProcess.call( this, data )
		.next( () => {
			this.actions.setMode("edit");
			this.setPreferences(data.preferences);
			this.prefsForm.setPrefValues(data.preferences);
			// Set up window based on data
			this.bannerList.addItems(
				data.banners.map( bannerTemplate => new BannerWidget(
					bannerTemplate,
					{ preferences: this.preferences,
						$overlay: this.$overlay }
				) )
			);
			if (data.ores) {
				this.oresClass = data.ores.prediction;
				this.oresLabel.toggle(true).$element.find(".oresPrediction").append(
					$("<strong>").text(data.ores.prediction),
					"&nbsp;(" + data.ores.probability + ")"
				);
			}

			this.talkWikitext = data.talkWikitext;
			this.existingBannerNames = data.banners.map( bannerTemplate => bannerTemplate.name );
			this.talkpage = data.talkpage;
			this.updateSize();
		}, this );
};

// Set up the window it is ready: attached to the DOM, and opening animation completed
MainWindow.prototype.getReadyProcess = function ( data ) {
	data = data || {};
	return MainWindow.super.prototype.getReadyProcess.call( this, data )
		.next( () => this.searchBox.focus() );
};

// Use the getActionProcess() method to do things when actions are clicked
MainWindow.prototype.getActionProcess = function ( action ) {
	// FIXME: Make these actually do the things.
	if ( action === "showPrefs" ) {
		this.actions.setMode("prefs");
		this.contentArea.setItem( this.prefsLayout );
		this.topBar.setDisabled(true);
		this.updateSize();

	} else if ( action === "savePrefs" ) {
		var updatedPrefs = this.prefsForm.getPrefs();
		return new OO.ui.Process().next(
			ApiSetPrefs(updatedPrefs).then(
				// Success
				() => {
					this.setPreferences(updatedPrefs);
					this.actions.setMode("edit");
					this.contentArea.setItem( this.editLayout );
					this.topBar.setDisabled(false);
					this.updateSize();
				},
				// Failure
				(code, err) => $.Deferred().reject(
					new OO.ui.Error(
						$("<div>").append(
							$("<strong style='display:block;'>").text("Could not save preferences."),
							$("<span style='color:#777'>").text( makeErrorMsg(code, err) )
						)
					)
				)
			)
		);

	} else if ( action === "closePrefs" ) {
		console.log("[Rater] Close prefs clicked!");
		this.actions.setMode("edit");
		this.contentArea.setItem( this.editLayout );
		this.topBar.setDisabled(false);
		this.prefsForm.setPrefValues(this.preferences);
		this.updateSize();

	} else if ( action === "save" ) {
		var bannersWikitext = this.bannerList.makeWikitext();
		
		console.log("[Rater] Save clicked!");
		console.log(bannersWikitext);

		var dialog = this;   
		return new OO.ui.Process( function () {
			// Do something about the edit.
			dialog.close();
		} );

	} else if ( action === "preview" ) {
		return new OO.ui.Process().next(
			API.post({
				action: "parse",
				contentmodel: "wikitext",
				text: this.transformTalkWikitext(this.talkWikitext),
				title: this.talkpage.getPrefixedText(),
				pst: 1
			}).then( result => {
				if ( !result || !result.parse || !result.parse.text || !result.parse.text["*"] ) {
					return $.Deferred().reject("Empty result");
				}
				var previewHtmlSnippet = new OO.ui.HtmlSnippet(result.parse.text["*"]);

				this.parsedContentWidget.setLabel(previewHtmlSnippet);
				this.parsedContentContainer.setLabel("Preview:");
				this.actions.setMode("preview");
				this.contentArea.setItem( this.parsedContentLayout );
				this.topBar.setDisabled(true);
				this.updateSize();
			})
				.catch( (code, err) => $.Deferred().reject(
					new OO.ui.Error(
						$("<div>").append(
							$("<strong style='display:block;'>").text("Could not show changes."),
							$("<span style='color:#777'>").text( makeErrorMsg(code, err) )
						)
					)
				) )
		);

	} else if ( action === "changes" ) {
		return new OO.ui.Process().next(
			API.post({
				action: "compare",
				format: "json",
				fromtext: this.talkWikitext,
				fromcontentmodel: "wikitext",
				totext: this.transformTalkWikitext(this.talkWikitext),
				tocontentmodel: "wikitext",
				prop: "diff"
			})
				.then( result => {
					if ( !result || !result.compare || !result.compare["*"] ) {
						return $.Deferred().reject("Empty result");
					}
					var $diff = $("<table>").css("width", "100%").append(
						$("<tr>").append(
							$("<th>").attr({"colspan":"2", "scope":"col"}).css("width", "50%").text("Latest revision"),
							$("<th>").attr({"colspan":"2", "scope":"col"}).css("width", "50%").text("New text")
						),
						result.compare["*"]
					);

					this.parsedContentWidget.setLabel($diff);
					this.parsedContentContainer.setLabel("Changes:");
					this.actions.setMode("diff");
					this.contentArea.setItem( this.parsedContentLayout );
					this.topBar.setDisabled(true);
					this.updateSize();
				} )
				.catch( (code, err) => $.Deferred().reject(
					new OO.ui.Error(
						$("<div>").append(
							$("<strong style='display:block;'>").text("Could not show changes."),
							$("<span style='color:#777'>").text( makeErrorMsg(code, err) )
						)
					)
				) )
		);

	} else if ( action === "back" ) {
		this.actions.setMode("edit");
		this.contentArea.setItem( this.editLayout );
		this.topBar.setDisabled(false);
		this.updateSize();
	}

	return MainWindow.super.prototype.getActionProcess.call( this, action );
};

// Use the getTeardownProcess() method to perform actions whenever the dialog is closed.
// `data` is the data passed into the window's .close() method.
MainWindow.prototype.getTeardownProcess = function ( data ) {
	return MainWindow.super.prototype.getTeardownProcess.call( this, data )
		.first( () => {
			this.bannerList.clearItems();
			this.searchBox.setValue("");
			this.contentArea.setItem( this.editLayout );
			this.topBar.setDisabled(false);
			this.oresLabel.toggle(false).$element.find(".oresPrediction").empty();
		} );
};

MainWindow.prototype.setPreferences = function(prefs) {
	this.preferences = $.extend({}, appConfig.defaultPrefs, prefs);
	// Applies preferences to existing items in the window:
	this.bannerList.setPreferences(this.preferences);
};

MainWindow.prototype.onSearchSelect = function() {
	this.searchBox.pushPending();
	var name = this.searchBox.getValue().trim();
	if (!name) {
		this.searchBox.popPending();
		return;
	}
	var existingBanner = this.bannerList.items.find(banner => {
		return banner.mainText === name ||	banner.redirectTargetMainText === name;
	});
	if (existingBanner) {
		// TODO: show error message
		console.log("There is already a {{" + name + "}} banner");
		this.searchBox.popPending();
		return;
	}
	if (!/^[Ww](?:P|iki[Pp]roject)/.test(name)) {
		var message = new OO.ui.HtmlSnippet(
			"<code>{{" + name + "}}</code> is not a recognised WikiProject banner.<br/>Do you want to continue?"
		);
		// TODO: ask for confirmation
		console.log(message);
	}
	if (name === "WikiProject Disambiguation" && $("#ca-talk.new").length !== 0 && this.bannerList.items.length === 0) {
		// eslint-disable-next-line no-useless-escape
		var noNewDabMessage = "New talk pages shouldn't be created if they will only contain the \{\{WikiProject Disambiguation\}\} banner. Continue?";
		// TODO: ask for confirmation
		console.log(noNewDabMessage);
	}
	// Create Template object
	BannerWidget.newFromTemplateName(name, {preferences: this.preferences, $overlay: this.$overlay})
		.then(banner => {
			this.bannerList.addItems( [banner] );
			this.updateSize();
			this.searchBox.setValue("");
			this.searchBox.popPending();
		});
};

MainWindow.prototype.transformTalkWikitext = function(talkWikitext) {
	var bannersWikitext = this.bannerList.makeWikitext();
	if (!talkWikitext) {
		return bannersWikitext.trim();
	}
	// Reparse templates, in case talkpage wikitext has changed
	var talkTemplates = parseTemplates(talkWikitext, true);
	// replace existing banners wikitext with a control character
	talkTemplates.forEach(template => {
		if (this.existingBannerNames.includes(template.name)) {
			talkWikitext = talkWikitext.replace(template.wikitext, "\x01");
		}
	});
	// replace insertion point (first control character) with a different control character
	talkWikitext = talkWikitext.replace("\x01", "\x02");
	// remove other control characters
	/* eslint-disable-next-line no-control-regex */
	talkWikitext = talkWikitext.replace(/(?:\s|\n)*\x01(?:\s|\n)*/g,"");
	// split into wikitext before/after the remaining control character (and trim each section)
	var talkWikitextSections = talkWikitext.split("\x02").map(t => t.trim());
	if (talkWikitextSections.length === 2) {
		// Found the insertion point for the banners
		return (talkWikitextSections[0] + "\n" + bannersWikitext.trim() + "\n" + talkWikitextSections[1]).trim();
	}
	// Check if there's anything beside templates
	var tempStr = talkWikitext;
	talkTemplates.forEach(template => {
		tempStr = tempStr.replace(template.wikitext, "");
	});
	if (tempStr.trim()) {
		// There is non-template content, so insert at the start
		return bannersWikitext.trim() + "\n" + talkWikitext.trim();
	} else {
		// Everything is a template, so insert at the end
		return talkWikitext.trim() + "\n" + bannersWikitext.trim();
	}
};

export default MainWindow;